import { Hono } from 'hono';
import type { Env } from '../index';
import {
  AMOUNT_MIN,
  AMOUNT_MAX,
  EXPENSE_NOTE_MAX_LENGTH,
} from '@mycarcost/shared';

const incomes = new Hono<{ Bindings: Env }>();

function validateIncomeBody(body: any): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!body.date || typeof body.date !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(body.date)) {
    errors['date'] = '请选择日期';
  }

  if (body.amount === undefined || body.amount === null) {
    errors['amount'] = '请输入金额';
  } else if (typeof body.amount !== 'number' || isNaN(body.amount) || body.amount < AMOUNT_MIN || body.amount > AMOUNT_MAX) {
    errors['amount'] = `金额必须在${AMOUNT_MIN}至${AMOUNT_MAX}之间`;
  }

  if (body.typeName !== undefined && body.typeName !== null && typeof body.typeName !== 'string') {
    errors['typeName'] = '收入类型格式错误';
  } else if (typeof body.typeName === 'string' && body.typeName.length > 20) {
    errors['typeName'] = '收入类型不能超过20个字符';
  }

  if (body.note !== undefined && body.note !== null && typeof body.note !== 'string') {
    errors['note'] = '备注格式错误';
  } else if (typeof body.note === 'string' && body.note.length > EXPENSE_NOTE_MAX_LENGTH) {
    errors['note'] = `备注不能超过${EXPENSE_NOTE_MAX_LENGTH}个字符`;
  }

  return errors;
}

// GET /api/vehicles/:vehicleId/incomes
incomes.get('/:vehicleId/incomes', async (c) => {
  const db = c.env.DB;
  const vehicleId = c.req.param('vehicleId');

  const vehicle = await db
    .prepare('SELECT id FROM vehicles WHERE id = ?')
    .bind(vehicleId)
    .first();
  if (!vehicle) {
    return c.json({ error: '车辆不存在' }, 404);
  }

  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query('pageSize') || '20', 10)));
  const offset = (page - 1) * pageSize;

  const countResult = await db
    .prepare('SELECT COUNT(*) AS total FROM incomes WHERE vehicleId = ?')
    .bind(vehicleId)
    .first<{ total: number }>();
  const total = countResult?.total || 0;

  const records = await db
    .prepare(
      `SELECT * FROM incomes WHERE vehicleId = ? ORDER BY date DESC, createdAt DESC LIMIT ? OFFSET ?`
    )
    .bind(vehicleId, pageSize, offset)
    .all();

  return c.json({
    incomes: records.results,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
});

// POST /api/vehicles/:vehicleId/incomes
incomes.post('/:vehicleId/incomes', async (c) => {
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

  const errors = validateIncomeBody(body);
  if (Object.keys(errors).length > 0) {
    return c.json({ error: '验证失败', fields: errors }, 400);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  try {
    await db
      .prepare(
        `INSERT INTO incomes (id, vehicleId, date, amount, typeName, note, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        vehicleId,
        body.date.slice(0, 10),
        body.amount,
        body.typeName?.trim() || null,
        body.note?.trim() || null,
        now,
        now
      )
      .run();

    const created = await db.prepare('SELECT * FROM incomes WHERE id = ?').bind(id).first();
    return c.json(created, 201);
  } catch (error) {
    return c.json({ error: '创建收入记录失败' }, 500);
  }
});

// PUT /api/incomes/:id
incomes.put('/:id', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');

  const existing = await db.prepare('SELECT * FROM incomes WHERE id = ?').bind(id).first();
  if (!existing) {
    return c.json({ error: '收入记录不存在' }, 404);
  }

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: '请求体格式错误' }, 400);
  }

  const errors = validateIncomeBody(body);
  if (Object.keys(errors).length > 0) {
    return c.json({ error: '验证失败', fields: errors }, 400);
  }

  const now = new Date().toISOString();

  try {
    await db
      .prepare(
        `UPDATE incomes SET date = ?, amount = ?, typeName = ?, note = ?, updatedAt = ? WHERE id = ?`
      )
      .bind(
        body.date.slice(0, 10),
        body.amount,
        body.typeName?.trim() || null,
        body.note?.trim() || null,
        now,
        id
      )
      .run();

    const updated = await db.prepare('SELECT * FROM incomes WHERE id = ?').bind(id).first();
    return c.json(updated);
  } catch (error) {
    return c.json({ error: '更新收入记录失败' }, 500);
  }
});

// DELETE /api/incomes/:id
incomes.delete('/:id', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');

  try {
    const result = await db.prepare('DELETE FROM incomes WHERE id = ?').bind(id).run();
    if (!result.meta.changes) {
      return c.json({ error: '收入记录不存在' }, 404);
    }
    return c.json({ success: true, id });
  } catch (error) {
    return c.json({ error: '删除收入记录失败' }, 500);
  }
});

export default incomes;
