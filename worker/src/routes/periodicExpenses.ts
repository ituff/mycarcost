import { Hono } from 'hono';
import type { Env } from '../index';
import type { Period } from '@mycarcost/shared';

const periodicExpenses = new Hono<{ Bindings: Env }>();

const VALID_PERIODS: Period[] = ['daily', 'monthly', 'yearly'];

function validatePeriodicExpenseBody(body: any): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!body.expenseTypeId) {
    errors['expenseTypeId'] = '请选择费用类型';
  }

  if (body.amount === undefined || body.amount === null) {
    errors['amount'] = '请输入金额';
  } else if (typeof body.amount !== 'number' || isNaN(body.amount) || body.amount < 0.01 || body.amount > 999999999.99) {
    errors['amount'] = '金额必须在0.01至999999999.99之间';
  }

  if (!body.period || !VALID_PERIODS.includes(body.period)) {
    errors['period'] = '周期必须为每日、每月或每年';
  }

  if (!body.startDate || !/^\d{4}-\d{2}-\d{2}/.test(body.startDate)) {
    errors['startDate'] = '请选择开始日期';
  }
  if (!body.endDate || !/^\d{4}-\d{2}-\d{2}/.test(body.endDate)) {
    errors['endDate'] = '请选择结束日期';
  } else if (body.startDate && body.endDate < body.startDate) {
    errors['endDate'] = '结束日期不能早于开始日期';
  }

  return errors;
}

// GET /api/vehicles/:vehicleId/periodic-expenses
periodicExpenses.get('/:vehicleId/periodic-expenses', async (c) => {
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
      `SELECT pe.*, et.name AS expenseTypeName, et.color AS expenseTypeColor
       FROM periodic_expenses pe
       LEFT JOIN expense_types et ON et.id = pe.expenseTypeId
       WHERE pe.vehicleId = ?
       ORDER BY pe.startDate DESC`
    )
    .bind(vehicleId)
    .all();

  return c.json({ periodicExpenses: records.results });
});

// POST /api/vehicles/:vehicleId/periodic-expenses
periodicExpenses.post('/:vehicleId/periodic-expenses', async (c) => {
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

  const errors = validatePeriodicExpenseBody(body);
  if (Object.keys(errors).length > 0) {
    return c.json({ error: '验证失败', fields: errors }, 400);
  }

  const expenseType = await db
    .prepare('SELECT id FROM expense_types WHERE id = ?')
    .bind(body.expenseTypeId)
    .first();
  if (!expenseType) {
    return c.json({ error: '费用类型不存在', field: 'expenseTypeId' }, 400);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  try {
    await db
      .prepare(
        `INSERT INTO periodic_expenses (id, vehicleId, expenseTypeId, amount, period, startDate, endDate, lastGeneratedDate, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        vehicleId,
        body.expenseTypeId,
        body.amount,
        body.period as Period,
        body.startDate.slice(0, 10),
        body.endDate.slice(0, 10),
        // 不回溯历史：从登记当天起由定时任务生成
        todayStr(),
        now,
        now
      )
      .run();

    const created = await db
      .prepare('SELECT * FROM periodic_expenses WHERE id = ?')
      .bind(id)
      .first();

    return c.json(created, 201);
  } catch (error) {
    return c.json({ error: '创建周期费用失败' }, 500);
  }
});

// PUT /api/periodic-expenses/:id
periodicExpenses.put('/:id', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');

  const existing = await db
    .prepare('SELECT * FROM periodic_expenses WHERE id = ?')
    .bind(id)
    .first();
  if (!existing) {
    return c.json({ error: '周期费用不存在' }, 404);
  }

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: '请求体格式错误' }, 400);
  }

  const errors = validatePeriodicExpenseBody(body);
  if (Object.keys(errors).length > 0) {
    return c.json({ error: '验证失败', fields: errors }, 400);
  }

  const expenseType = await db
    .prepare('SELECT id FROM expense_types WHERE id = ?')
    .bind(body.expenseTypeId)
    .first();
  if (!expenseType) {
    return c.json({ error: '费用类型不存在', field: 'expenseTypeId' }, 400);
  }

  const now = new Date().toISOString();

  try {
    await db
      .prepare(
        `UPDATE periodic_expenses SET expenseTypeId = ?, amount = ?, period = ?, startDate = ?, endDate = ?, lastGeneratedDate = ?, updatedAt = ? WHERE id = ?`
      )
      .bind(
        body.expenseTypeId,
        body.amount,
        body.period as Period,
        body.startDate.slice(0, 10),
        body.endDate.slice(0, 10),
        // 修改周期后从今天起按新规则生成
        todayStr(),
        now,
        id
      )
      .run();

    const updated = await db
      .prepare('SELECT * FROM periodic_expenses WHERE id = ?')
      .bind(id)
      .first();

    return c.json(updated);
  } catch (error) {
    return c.json({ error: '更新周期费用失败' }, 500);
  }
});

// DELETE /api/periodic-expenses/:id
periodicExpenses.delete('/:id', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');

  try {
    const result = await db.prepare('DELETE FROM periodic_expenses WHERE id = ?').bind(id).run();
    if (!result.meta.changes) {
      return c.json({ error: '周期费用不存在' }, 404);
    }
    return c.json({ success: true, id });
  } catch (error) {
    return c.json({ error: '删除周期费用失败' }, 500);
  }
});

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export default periodicExpenses;
