import { Hono } from 'hono';
import type { Env } from '../index';
import {
  VEHICLE_NAME_MIN_LENGTH,
  VEHICLE_NAME_MAX_LENGTH,
  MAX_VEHICLES,
} from '@mycarcost/shared';
import type { VehicleType } from '@mycarcost/shared';

const vehicles = new Hono<{ Bindings: Env }>();

const VALID_TYPES: VehicleType[] = ['fuel', 'electric', 'hybrid'];

// 与能耗记录燃料类型的兼容性（类型变更时检查不兼容记录数）
function fuelTypeCompatible(vehicleType: VehicleType, fuelType: string): boolean {
  switch (vehicleType) {
    case 'fuel':
      return fuelType === 'gasoline' || fuelType === 'diesel';
    case 'electric':
      return fuelType === 'electric';
    case 'hybrid':
    default:
      return true;
  }
}

function validateVehicleBody(body: any): Record<string, string> {
  const errors: Record<string, string> = {};

  const name = body.name?.trim();
  if (!name) {
    errors['name'] = '请输入车辆名称';
  } else if (name.length < VEHICLE_NAME_MIN_LENGTH || name.length > VEHICLE_NAME_MAX_LENGTH) {
    errors['name'] = `车辆名称必须在${VEHICLE_NAME_MIN_LENGTH}至${VEHICLE_NAME_MAX_LENGTH}个字符之间`;
  }

  if (!body.type || !VALID_TYPES.includes(body.type)) {
    errors['type'] = '车辆类型必须为燃油车、电动车或插电混合动力';
  }

  return errors;
}

// GET /api/vehicles - list with total mileage and total expense
vehicles.get('/', async (c) => {
  const db = c.env.DB;

  const results = await db
    .prepare(
      `SELECT v.*,
              (SELECT MAX(mileage) FROM consumptions WHERE vehicleId = v.id) AS totalMileage,
              (
                (SELECT COALESCE(SUM(COALESCE(totalPrice, unitPrice * quantity)), 0) FROM consumptions WHERE vehicleId = v.id)
                +
                (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE vehicleId = v.id)
              ) AS totalExpense
       FROM vehicles v
       ORDER BY createdAt ASC`
    )
    .all();

  const list = (results.results as any[]).map((v) => ({
    ...v,
    totalMileage: v.totalMileage || 0,
    totalExpense: Math.round((v.totalExpense || 0) * 100) / 100,
  }));

  return c.json({ vehicles: list });
});

// POST /api/vehicles
vehicles.post('/', async (c) => {
  const db = c.env.DB;

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: '请求体格式错误' }, 400);
  }

  const errors = validateVehicleBody(body);
  if (Object.keys(errors).length > 0) {
    return c.json({ error: '验证失败', fields: errors }, 400);
  }

  const count = await db.prepare('SELECT COUNT(*) AS n FROM vehicles').first<{ n: number }>();
  if ((count?.n || 0) >= MAX_VEHICLES) {
    return c.json({ error: `最多支持管理${MAX_VEHICLES}辆车辆`, field: 'name' }, 400);
  }

  const name = body.name.trim();
  const dup = await db.prepare('SELECT id FROM vehicles WHERE name = ?').bind(name).first();
  if (dup) {
    return c.json({ error: '名称已存在', field: 'name' }, 400);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  try {
    await db
      .prepare('INSERT INTO vehicles (id, name, type, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)')
      .bind(id, name, body.type, now, now)
      .run();

    const created = await db
      .prepare('SELECT * FROM vehicles WHERE id = ?')
      .bind(id)
      .first();
    return c.json(created, 201);
  } catch (error) {
    return c.json({ error: '创建车辆失败' }, 500);
  }
});

// PUT /api/vehicles/:id
vehicles.put('/:id', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');

  const existing = await db
    .prepare('SELECT * FROM vehicles WHERE id = ?')
    .bind(id)
    .first<any>();
  if (!existing) {
    return c.json({ error: '车辆不存在' }, 404);
  }

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: '请求体格式错误' }, 400);
  }

  const errors = validateVehicleBody(body);
  if (Object.keys(errors).length > 0) {
    return c.json({ error: '验证失败', fields: errors }, 400);
  }

  const name = body.name.trim();
  const dup = await db
    .prepare('SELECT id FROM vehicles WHERE name = ? AND id != ?')
    .bind(name, id)
    .first();
  if (dup) {
    return c.json({ error: '名称已存在', field: 'name' }, 400);
  }

  // Type change compatibility check
  const newType = body.type as VehicleType;
  let incompatibleCount = 0;
  if (newType !== existing.type) {
    const counts = await db
      .prepare('SELECT fuelType, COUNT(*) AS n FROM consumptions WHERE vehicleId = ? GROUP BY fuelType')
      .bind(id)
      .all();
    for (const row of counts.results as any[]) {
      if (!fuelTypeCompatible(newType, row.fuelType)) {
        incompatibleCount += row.n;
      }
    }
  }

  const now = new Date().toISOString();

  try {
    await db
      .prepare('UPDATE vehicles SET name = ?, type = ?, updatedAt = ? WHERE id = ?')
      .bind(name, newType, now, id)
      .run();

    const updated = await db.prepare('SELECT * FROM vehicles WHERE id = ?').bind(id).first();
    return c.json({ ...updated, incompatibleCount });
  } catch (error) {
    return c.json({ error: '更新车辆失败' }, 500);
  }
});

// DELETE /api/vehicles/:id - cascade deletes related records via FK
vehicles.delete('/:id', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');

  try {
    const result = await db.prepare('DELETE FROM vehicles WHERE id = ?').bind(id).run();
    if (!result.meta.changes) {
      return c.json({ error: '车辆不存在' }, 404);
    }
    return c.json({ success: true, id });
  } catch (error) {
    return c.json({ error: '删除车辆失败' }, 500);
  }
});

export default vehicles;
