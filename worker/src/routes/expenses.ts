import { Hono } from 'hono';
import type { Env } from '../index';
import {
  AMOUNT_MIN,
  AMOUNT_MAX,
  EXPENSE_NOTE_MAX_LENGTH,
  MAX_NOTE_SUGGESTIONS,
} from '@mycarcost/shared';

const expenses = new Hono<{ Bindings: Env }>();

function validateExpenseBody(body: any): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!body.date || typeof body.date !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(body.date)) {
    errors['date'] = '请选择日期';
  }

  if (!body.expenseTypeId) {
    errors['expenseTypeId'] = '请选择费用类型';
  }

  if (body.amount === undefined || body.amount === null) {
    errors['amount'] = '请输入金额';
  } else if (typeof body.amount !== 'number' || isNaN(body.amount) || body.amount < AMOUNT_MIN || body.amount > AMOUNT_MAX) {
    errors['amount'] = `金额必须在${AMOUNT_MIN}至${AMOUNT_MAX}之间`;
  }

  if (body.note !== undefined && body.note !== null && typeof body.note !== 'string') {
    errors['note'] = '备注格式错误';
  } else if (typeof body.note === 'string' && body.note.length > EXPENSE_NOTE_MAX_LENGTH) {
    errors['note'] = `备注不能超过${EXPENSE_NOTE_MAX_LENGTH}个字符`;
  }

  return errors;
}

// GET /api/vehicles/:vehicleId/expenses - list with pagination and time filter
expenses.get('/:vehicleId/expenses', async (c) => {
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

  const startDate = c.req.query('startDate');
  const endDate = c.req.query('endDate');

  let whereClause = 'WHERE e.vehicleId = ?';
  const params: any[] = [vehicleId];

  if (startDate) {
    whereClause += ' AND e.date >= ?';
    params.push(startDate);
  }
  if (endDate) {
    whereClause += ' AND e.date <= ?';
    params.push(endDate);
  }

  const countResult = await db
    .prepare(`SELECT COUNT(*) AS total FROM expenses e ${whereClause}`)
    .bind(...params)
    .first<{ total: number }>();
  const total = countResult?.total || 0;

  const records = await db
    .prepare(
      `SELECT e.*, et.name AS expenseTypeName, et.color AS expenseTypeColor
       FROM expenses e
       LEFT JOIN expense_types et ON et.id = e.expenseTypeId
       ${whereClause}
       ORDER BY e.date DESC
       LIMIT ? OFFSET ?`
    )
    .bind(...params, pageSize, offset)
    .all();

  return c.json({
    expenses: records.results,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
});

// GET /api/vehicles/:vehicleId/expenses/notes - note history
expenses.get('/:vehicleId/expenses/notes', async (c) => {
  const db = c.env.DB;
  const vehicleId = c.req.param('vehicleId');

  const results = await db
    .prepare(
      `SELECT DISTINCT note FROM expenses
       WHERE vehicleId = ? AND note IS NOT NULL AND note != ''
       ORDER BY updatedAt DESC
       LIMIT ?`
    )
    .bind(vehicleId, MAX_NOTE_SUGGESTIONS)
    .all();

  return c.json({ notes: results.results.map((r: any) => r.note) });
});

// POST /api/vehicles/:vehicleId/expenses
expenses.post('/:vehicleId/expenses', async (c) => {
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

  const errors = validateExpenseBody(body);
  if (Object.keys(errors).length > 0) {
    return c.json({ error: '验证失败', fields: errors }, 400);
  }

  const { date, expenseTypeId, amount, note } = body;

  const expenseType = await db
    .prepare('SELECT id FROM expense_types WHERE id = ?')
    .bind(expenseTypeId)
    .first();
  if (!expenseType) {
    return c.json({ error: '费用类型不存在', field: 'expenseTypeId' }, 400);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  try {
    await db
      .prepare(
        `INSERT INTO expenses (id, vehicleId, expenseTypeId, date, amount, note, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, vehicleId, expenseTypeId, date.slice(0, 10), amount, note?.trim() || null, now, now)
      .run();

    const created = await db
      .prepare('SELECT * FROM expenses WHERE id = ?')
      .bind(id)
      .first();

    return c.json(created, 201);
  } catch (error) {
    return c.json({ error: '创建费用记录失败' }, 500);
  }
});

// PUT /api/expenses/:id
expenses.put('/:id', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');

  const existing = await db
    .prepare('SELECT * FROM expenses WHERE id = ?')
    .bind(id)
    .first();
  if (!existing) {
    return c.json({ error: '费用记录不存在' }, 404);
  }

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: '请求体格式错误' }, 400);
  }

  const errors = validateExpenseBody(body);
  if (Object.keys(errors).length > 0) {
    return c.json({ error: '验证失败', fields: errors }, 400);
  }

  const { date, expenseTypeId, amount, note } = body;

  const expenseType = await db
    .prepare('SELECT id FROM expense_types WHERE id = ?')
    .bind(expenseTypeId)
    .first();
  if (!expenseType) {
    return c.json({ error: '费用类型不存在', field: 'expenseTypeId' }, 400);
  }

  const now = new Date().toISOString();

  try {
    await db
      .prepare(
        `UPDATE expenses SET date = ?, expenseTypeId = ?, amount = ?, note = ?, updatedAt = ? WHERE id = ?`
      )
      .bind(date.slice(0, 10), expenseTypeId, amount, note?.trim() || null, now, id)
      .run();

    const updated = await db
      .prepare('SELECT * FROM expenses WHERE id = ?')
      .bind(id)
      .first();

    return c.json(updated);
  } catch (error) {
    return c.json({ error: '更新费用记录失败' }, 500);
  }
});

// DELETE /api/expenses/:id
expenses.delete('/:id', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');

  try {
    const result = await db.prepare('DELETE FROM expenses WHERE id = ?').bind(id).run();
    if (!result.meta.changes) {
      return c.json({ error: '费用记录不存在' }, 404);
    }
    return c.json({ success: true, id });
  } catch (error) {
    return c.json({ error: '删除费用记录失败' }, 500);
  }
});

export default expenses;
