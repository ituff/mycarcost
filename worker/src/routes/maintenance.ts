import { Hono } from 'hono';
import type { Env } from '../index';
import { MILEAGE_MIN, MILEAGE_MAX } from '@mycarcost/shared';

const maintenance = new Hono<{ Bindings: Env }>();

/** 记录为费用时使用的费用类型名与默认颜色 */
const EXPENSE_TYPE_NAME = '维修保养';
const EXPENSE_TYPE_COLOR = '#f59e0b';

async function ensureExpenseTypeId(db: Env['DB']): Promise<string | null> {
  const found = await db
    .prepare('SELECT id FROM expense_types WHERE name = ?')
    .bind(EXPENSE_TYPE_NAME)
    .first<{ id: string }>();
  if (found) return found.id;

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO expense_types (id, name, color, isAmortized, amortizedMonths, createdAt, updatedAt)
       VALUES (?, ?, ?, 0, NULL, ?, ?)`
    )
    .bind(id, EXPENSE_TYPE_NAME, EXPENSE_TYPE_COLOR, now, now)
    .run();
  return id;
}

function validateMaintenanceBody(body: any): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!body.recordTime || typeof body.recordTime !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(body.recordTime)) {
    errors['recordTime'] = '请选择保养时间';
  }

  if (body.mileage === undefined || body.mileage === null) {
    errors['mileage'] = '请输入当前里程';
  } else if (typeof body.mileage !== 'number' || isNaN(body.mileage) || body.mileage < MILEAGE_MIN || body.mileage > MILEAGE_MAX) {
    errors['mileage'] = `里程必须在${MILEAGE_MIN}至${MILEAGE_MAX}之间`;
  }

  if (body.amount === undefined || body.amount === null) {
    errors['amount'] = '请输入支出金额';
  } else if (typeof body.amount !== 'number' || isNaN(body.amount) || body.amount < 0 || body.amount > 999999999.99) {
    errors['amount'] = '金额必须在0至999999999.99之间';
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    errors['items'] = '请至少选择或输入一个保养项目';
  } else if (body.items.some((i: any) => typeof i !== 'string' || !i.trim() || i.trim().length > 30)) {
    errors['items'] = '保养项目格式错误';
  }

  if (body.note !== undefined && body.note !== null && (typeof body.note !== 'string' || body.note.length > 1000)) {
    errors['note'] = '备注不能超过1000个字符';
  }

  if (body.recordAsExpense !== undefined && typeof body.recordAsExpense !== 'boolean') {
    errors['recordAsExpense'] = '记录为费用标记格式错误';
  }

  return errors;
}

async function createLinkedExpense(db: Env['DB'], vehicleId: string, body: any): Promise<string | null> {
  // 金额为 0 不生成费用记录（费用记录最小 0.01）
  if (!body.amount || body.amount < 0.01) return null;
  const expenseTypeId = await ensureExpenseTypeId(db);
  if (!expenseTypeId) return null;

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO expenses (id, vehicleId, expenseTypeId, date, amount, note, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      vehicleId,
      expenseTypeId,
      body.recordTime.slice(0, 10),
      body.amount,
      `保养：${(body.items as string[]).join('、')}${body.note ? `（${body.note}）` : ''}`.slice(0, 200),
      now,
      now
    )
    .run();
  return id;
}

// GET /api/vehicles/:vehicleId/maintenance
maintenance.get('/:vehicleId/maintenance', async (c) => {
  const db = c.env.DB;
  const vehicleId = c.req.param('vehicleId');

  const vehicle = await db
    .prepare('SELECT id FROM vehicles WHERE id = ?')
    .bind(vehicleId)
    .first();
  if (!vehicle) {
    return c.json({ error: '车辆不存在' }, 404);
  }

  const records = await db
    .prepare(
      `SELECT * FROM maintenance_records WHERE vehicleId = ? ORDER BY recordTime DESC`
    )
    .bind(vehicleId)
    .all();

  return c.json({
    maintenanceRecords: (records.results as any[]).map((r) => ({
      ...r,
      items: JSON.parse(r.items),
    })),
  });
});

// POST /api/vehicles/:vehicleId/maintenance
maintenance.post('/:vehicleId/maintenance', async (c) => {
  const db = c.env.DB;
  const vehicleId = c.req.param('vehicleId');

  const vehicle = await db
    .prepare('SELECT id FROM vehicles WHERE id = ?')
    .bind(vehicleId)
    .first();
  if (!vehicle) {
    return c.json({ error: '车辆不存在' }, 404);
  }

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: '请求体格式错误' }, 400);
  }

  const errors = validateMaintenanceBody(body);
  if (Object.keys(errors).length > 0) {
    return c.json({ error: '验证失败', fields: errors }, 400);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  try {
    let expenseId: string | null = null;
    if (body.recordAsExpense !== false) {
      expenseId = await createLinkedExpense(db, vehicleId, body);
    }

    await db
      .prepare(
        `INSERT INTO maintenance_records (id, vehicleId, recordTime, mileage, amount, items, note, expenseId, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        vehicleId,
        body.recordTime.length > 10 ? body.recordTime : body.recordTime + 'T00:00:00',
        body.mileage,
        body.amount,
        JSON.stringify((body.items as string[]).map((i: string) => i.trim())),
        body.note?.trim() || null,
        expenseId,
        now,
        now
      )
      .run();

    const created = await db
      .prepare('SELECT * FROM maintenance_records WHERE id = ?')
      .bind(id)
      .first<any>();
    return c.json({ ...created, items: JSON.parse(created.items) }, 201);
  } catch (error) {
    return c.json({ error: '创建保养记录失败' }, 500);
  }
});

// PUT /api/maintenance/:id
maintenance.put('/:id', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');

  const existing = await db
    .prepare('SELECT * FROM maintenance_records WHERE id = ?')
    .bind(id)
    .first<any>();
  if (!existing) {
    return c.json({ error: '保养记录不存在' }, 404);
  }

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: '请求体格式错误' }, 400);
  }

  const errors = validateMaintenanceBody(body);
  if (Object.keys(errors).length > 0) {
    return c.json({ error: '验证失败', fields: errors }, 400);
  }

  const now = new Date().toISOString();
  const itemsJson = JSON.stringify((body.items as string[]).map((i: string) => i.trim()));

  try {
    let expenseId: string | null = existing.expenseId ?? null;
    const wantExpense = body.recordAsExpense !== false;

    if (wantExpense && !expenseId) {
      expenseId = await createLinkedExpense(db, existing.vehicleId, body);
    } else if (wantExpense && expenseId) {
      // 同步已关联的费用记录
      const note = `保养：${(body.items as string[]).join('、')}${body.note ? `（${body.note}）` : ''}`.slice(0, 200);
      if (body.amount >= 0.01) {
        await db
          .prepare('UPDATE expenses SET date = ?, amount = ?, note = ?, updatedAt = ? WHERE id = ?')
          .bind(body.recordTime.slice(0, 10), body.amount, note, now, expenseId)
          .run();
      } else {
        // 金额变为 0：删除关联费用
        await db.prepare('DELETE FROM expenses WHERE id = ?').bind(expenseId).run();
        expenseId = null;
      }
    } else if (!wantExpense && expenseId) {
      await db.prepare('DELETE FROM expenses WHERE id = ?').bind(expenseId).run();
      expenseId = null;
    }

    await db
      .prepare(
        `UPDATE maintenance_records SET recordTime = ?, mileage = ?, amount = ?, items = ?, note = ?, expenseId = ?, updatedAt = ? WHERE id = ?`
      )
      .bind(
        body.recordTime.length > 10 ? body.recordTime : body.recordTime + 'T00:00:00',
        body.mileage,
        body.amount,
        itemsJson,
        body.note?.trim() || null,
        expenseId,
        now,
        id
      )
      .run();

    const updated = await db
      .prepare('SELECT * FROM maintenance_records WHERE id = ?')
      .bind(id)
      .first<any>();
    return c.json({ ...updated, items: JSON.parse(updated.items) });
  } catch (error) {
    return c.json({ error: '更新保养记录失败' }, 500);
  }
});

// DELETE /api/maintenance/:id - linked expense record is removed too
maintenance.delete('/:id', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');

  try {
    const existing = await db
      .prepare('SELECT * FROM maintenance_records WHERE id = ?')
      .bind(id)
      .first<any>();
    if (!existing) {
      return c.json({ error: '保养记录不存在' }, 404);
    }

    if (existing.expenseId) {
      await db.prepare('DELETE FROM expenses WHERE id = ?').bind(existing.expenseId).run();
    }
    await db.prepare('DELETE FROM maintenance_records WHERE id = ?').bind(id).run();

    return c.json({ success: true, id });
  } catch (error) {
    return c.json({ error: '删除保养记录失败' }, 500);
  }
});

export default maintenance;
