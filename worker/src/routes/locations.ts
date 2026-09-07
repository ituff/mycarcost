import { Hono } from 'hono';
import type { Env } from '../index';
import {
  LOCATION_NAME_MIN_LENGTH,
  LOCATION_NAME_MAX_LENGTH,
  LOCATION_ADDRESS_MAX_LENGTH,
} from '@mycarcost/shared';

const locations = new Hono<{ Bindings: Env }>();

function validateLocationBody(body: any): Record<string, string> {
  const errors: Record<string, string> = {};

  const name = body.name?.trim();
  if (!name) {
    errors['name'] = '请输入地点名称';
  } else if (name.length < LOCATION_NAME_MIN_LENGTH || name.length > LOCATION_NAME_MAX_LENGTH) {
    errors['name'] = `地点名称必须在${LOCATION_NAME_MIN_LENGTH}至${LOCATION_NAME_MAX_LENGTH}个字符之间`;
  }

  if (body.address !== undefined && body.address !== null && typeof body.address !== 'string') {
    errors['address'] = '地址格式错误';
  } else if (typeof body.address === 'string' && body.address.length > LOCATION_ADDRESS_MAX_LENGTH) {
    errors['address'] = `地址不能超过${LOCATION_ADDRESS_MAX_LENGTH}个字符`;
  }

  return errors;
}

// GET /api/locations - list all
locations.get('/', async (c) => {
  const db = c.env.DB;
  const results = await db
    .prepare('SELECT * FROM locations ORDER BY name ASC')
    .all();
  return c.json(results.results);
});

// GET /api/locations/search?q=keyword - case-insensitive LIKE on name/address
locations.get('/search', async (c) => {
  const db = c.env.DB;
  const q = (c.req.query('q') || '').trim();

  if (!q) {
    const results = await db.prepare('SELECT * FROM locations ORDER BY name ASC').all();
    return c.json(results.results);
  }

  const results = await db
    .prepare(
      `SELECT * FROM locations
       WHERE name LIKE ? COLLATE NOCASE OR address LIKE ? COLLATE NOCASE
       ORDER BY name ASC`
    )
    .bind(`%${q}%`, `%${q}%`)
    .all();
  return c.json(results.results);
});

// POST /api/locations
locations.post('/', async (c) => {
  const db = c.env.DB;

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: '请求体格式错误' }, 400);
  }

  const errors = validateLocationBody(body);
  if (Object.keys(errors).length > 0) {
    return c.json({ error: '验证失败', fields: errors }, 400);
  }

  const name = body.name.trim();
  const dup = await db.prepare('SELECT id FROM locations WHERE name = ?').bind(name).first();
  if (dup) {
    return c.json({ error: '名称已存在', field: 'name' }, 400);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  try {
    await db
      .prepare(
        `INSERT INTO locations (id, name, address, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)`
      )
      .bind(id, name, body.address?.trim() || null, now, now)
      .run();

    const created = await db.prepare('SELECT * FROM locations WHERE id = ?').bind(id).first();
    return c.json(created, 201);
  } catch (error) {
    return c.json({ error: '创建地点失败' }, 500);
  }
});

// PUT /api/locations/:id
locations.put('/:id', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');

  const existing = await db.prepare('SELECT * FROM locations WHERE id = ?').bind(id).first();
  if (!existing) {
    return c.json({ error: '地点不存在' }, 404);
  }

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: '请求体格式错误' }, 400);
  }

  const errors = validateLocationBody(body);
  if (Object.keys(errors).length > 0) {
    return c.json({ error: '验证失败', fields: errors }, 400);
  }

  const name = body.name.trim();
  const dup = await db
    .prepare('SELECT id FROM locations WHERE name = ? AND id != ?')
    .bind(name, id)
    .first();
  if (dup) {
    return c.json({ error: '名称已存在', field: 'name' }, 400);
  }

  const now = new Date().toISOString();

  try {
    await db
      .prepare('UPDATE locations SET name = ?, address = ?, updatedAt = ? WHERE id = ?')
      .bind(name, body.address?.trim() || null, now, id)
      .run();

    const updated = await db.prepare('SELECT * FROM locations WHERE id = ?').bind(id).first();
    return c.json(updated);
  } catch (error) {
    return c.json({ error: '更新地点失败' }, 500);
  }
});

// DELETE /api/locations/:id - consumptions.locationId set to NULL via FK action
locations.delete('/:id', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');

  try {
    const result = await db.prepare('DELETE FROM locations WHERE id = ?').bind(id).run();
    if (!result.meta.changes) {
      return c.json({ error: '地点不存在' }, 404);
    }
    return c.json({ success: true, id });
  } catch (error) {
    return c.json({ error: '删除地点失败' }, 500);
  }
});

export default locations;
