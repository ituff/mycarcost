import { Hono } from 'hono';
import type { Env } from '../index';

const expenseTypes = new Hono<{ Bindings: Env }>();

const VALID_COLORS = /^#[0-9a-fA-F]{6}$/;

function validateExpenseTypeBody(body: any): Record<string, string> {
  const errors: Record<string, string> = {};

  const name = body.name?.trim();
  if (!name) {
    errors['name'] = '请输入类型名称';
  } else if (name.length < 1 || name.length > 20) {
    errors['name'] = '类型名称必须在1至20个字符之间';
  }

  if (body.color !== undefined && body.color !== null && !VALID_COLORS.test(body.color)) {
    errors['color'] = '颜色格式错误';
  }

  if (body.isAmortized !== undefined && typeof body.isAmortized !== 'boolean') {
    errors['isAmortized'] = '分摊标记格式错误';
  }

  if (body.amortizedMonths !== undefined && body.amortizedMonths !== null) {
    const months = Number(body.amortizedMonths);
    if (!Number.isInteger(months) || months < 1 || months > 60) {
      errors['amortizedMonths'] = '分摊月数必须在1至60之间';
    }
  }

  return errors;
}

// GET /api/expense-types
expenseTypes.get('/', async (c) => {
  const db = c.env.DB;
  const results = await db.prepare('SELECT * FROM expense_types ORDER BY name ASC').all();
  return c.json(results.results);
});

// POST /api/expense-types
expenseTypes.post('/', async (c) => {
  const db = c.env.DB;

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: '请求体格式错误' }, 400);
  }

  const errors = validateExpenseTypeBody(body);
  if (Object.keys(errors).length > 0) {
    return c.json({ error: '验证失败', fields: errors }, 400);
  }

  const name = body.name.trim();
  const dup = await db.prepare('SELECT id FROM expense_types WHERE name = ?').bind(name).first();
  if (dup) {
    return c.json({ error: '名称已存在', field: 'name' }, 400);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const isAmortized = !!body.isAmortized;
  const amortizedMonths = isAmortized
    ? (Number(body.amortizedMonths) || 12)
    : null;

  try {
    await db
      .prepare(
        `INSERT INTO expense_types (id, name, color, isAmortized, amortizedMonths, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, name, body.color || '#3B82F6', isAmortized ? 1 : 0, amortizedMonths, now, now)
      .run();

    const created = await db.prepare('SELECT * FROM expense_types WHERE id = ?').bind(id).first();
    return c.json(created, 201);
  } catch (error) {
    return c.json({ error: '创建费用类型失败' }, 500);
  }
});

// PUT /api/expense-types/:id
expenseTypes.put('/:id', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');

  const existing = await db.prepare('SELECT * FROM expense_types WHERE id = ?').bind(id).first();
  if (!existing) {
    return c.json({ error: '费用类型不存在' }, 404);
  }

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: '请求体格式错误' }, 400);
  }

  const errors = validateExpenseTypeBody(body);
  if (Object.keys(errors).length > 0) {
    return c.json({ error: '验证失败', fields: errors }, 400);
  }

  const name = body.name.trim();
  const dup = await db
    .prepare('SELECT id FROM expense_types WHERE name = ? AND id != ?')
    .bind(name, id)
    .first();
  if (dup) {
    return c.json({ error: '名称已存在', field: 'name' }, 400);
  }

  const now = new Date().toISOString();
  const isAmortized = !!body.isAmortized;
  const amortizedMonths = isAmortized
    ? (Number(body.amortizedMonths) || 12)
    : null;

  try {
    await db
      .prepare(
        `UPDATE expense_types SET name = ?, color = ?, isAmortized = ?, amortizedMonths = ?, updatedAt = ? WHERE id = ?`
      )
      .bind(name, body.color || '#3B82F6', isAmortized ? 1 : 0, amortizedMonths, now, id)
      .run();

    const updated = await db.prepare('SELECT * FROM expense_types WHERE id = ?').bind(id).first();
    return c.json(updated);
  } catch (error) {
    return c.json({ error: '更新费用类型失败' }, 500);
  }
});

// DELETE /api/expense-types/:id - cascade deletes related expense records via FK
expenseTypes.delete('/:id', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');

  try {
    const result = await db.prepare('DELETE FROM expense_types WHERE id = ?').bind(id).run();
    if (!result.meta.changes) {
      return c.json({ error: '费用类型不存在' }, 404);
    }
    return c.json({ success: true, id });
  } catch (error) {
    return c.json({ error: '删除费用类型失败' }, 500);
  }
});

export default expenseTypes;
