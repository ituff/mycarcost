import { Hono } from 'hono';
import type { Env } from '../index';
import {
  MILEAGE_MIN,
  MILEAGE_MAX,
  QUANTITY_MIN,
  QUANTITY_MAX,
  UNIT_PRICE_MIN,
  UNIT_PRICE_MAX,
  BATTERY_PERCENT_MIN,
  BATTERY_PERCENT_MAX,
  ELECTRICITY_DETAILS_MIN_GROUPS,
  ELECTRICITY_DETAILS_MAX_GROUPS,
  CHARGING_CURRENT_MIN,
  CHARGING_CURRENT_MAX,
  ESTIMATED_RANGE_MIN,
  ESTIMATED_RANGE_MAX,
  isFuelTypeCompatible,
  calculateUnitPrice,
  calculatePer100km,
} from '@mycarcost/shared';
import type { FuelType, VehicleType, ChargingType } from '@mycarcost/shared';

const consumptions = new Hono<{ Bindings: Env }>();

// GET /api/vehicles/:vehicleId/consumptions - list with pagination + time filter
consumptions.get('/:vehicleId/consumptions', async (c) => {
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

  let whereClause = 'WHERE vehicleId = ?';
  const params: any[] = [vehicleId];

  if (startDate) {
    whereClause += ' AND recordTime >= ?';
    params.push(startDate);
  }
  if (endDate) {
    whereClause += ' AND recordTime <= ?';
    params.push(endDate + 'T23:59:59');
  }

  const countResult = await db
    .prepare(`SELECT COUNT(*) AS total FROM consumptions ${whereClause}`)
    .bind(...params)
    .first<{ total: number }>();
  const total = countResult?.total || 0;

  // Get records
  const records = await db
    .prepare(
      `SELECT * FROM consumptions ${whereClause} ORDER BY recordTime DESC LIMIT ? OFFSET ?`
    )
    .bind(...params, pageSize, offset)
    .all();

  // Per-100km per record (same pairing as the report: consecutive records by mileage)
  const allLight = await db
    .prepare(
      `SELECT id, mileage, quantity, fuelType FROM consumptions WHERE vehicleId = ? ORDER BY mileage ASC`
    )
    .bind(vehicleId)
    .all();
  const per100kmById = new Map<string, number>();
  for (const group of [
    (allLight.results as any[]).filter((r) => r.fuelType !== 'electric'),
    (allLight.results as any[]).filter((r) => r.fuelType === 'electric'),
  ]) {
    for (let i = 1; i < group.length; i++) {
      const distance = group[i].mileage - group[i - 1].mileage;
      if (distance > 0) {
        per100kmById.set(group[i].id, calculatePer100km(group[i].quantity, distance));
      }
    }
  }

  // Get electricity details for electric records
  const electricRecordIds = records.results
    .filter((r: any) => r.fuelType === 'electric')
    .map((r: any) => r.id);

  let electricityDetailsMap: Record<string, any[]> = {};
  if (electricRecordIds.length > 0) {
    const placeholders = electricRecordIds.map(() => '?').join(',');
    const details = await db
      .prepare(
        `SELECT * FROM consumption_electricity_details WHERE consumptionId IN (${placeholders}) ORDER BY sortOrder`
      )
      .bind(...electricRecordIds)
      .all();

    for (const detail of details.results) {
      const cid = (detail as any).consumptionId;
      if (!electricityDetailsMap[cid]) {
        electricityDetailsMap[cid] = [];
      }
      electricityDetailsMap[cid].push(detail);
    }
  }

  // Attach electricity details to records
  const consumptionsWithDetails = records.results.map((record: any) => ({
    ...record,
    per100km: per100kmById.get(record.id) ?? null,
    electricityDetails: electricityDetailsMap[record.id] || undefined,
  }));

  return c.json({
    consumptions: consumptionsWithDetails,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
});

// GET /api/consumptions/:id - single record with all fields (detail page)
consumptions.get('/:id', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');

  const record = await db
    .prepare(
      `SELECT c.*, v.name AS vehicleName, v.type AS vehicleType, l.name AS locationName
       FROM consumptions c
       JOIN vehicles v ON v.id = c.vehicleId
       LEFT JOIN locations l ON l.id = c.locationId
       WHERE c.id = ?`
    )
    .bind(id)
    .first<any>();
  if (!record) {
    return c.json({ error: '能耗记录不存在' }, 404);
  }

  const details = await db
    .prepare(
      `SELECT id, quantity, unitPrice, sortOrder FROM consumption_electricity_details
       WHERE consumptionId = ? ORDER BY sortOrder ASC`
    )
    .bind(id)
    .all();

  return c.json({ ...record, electricityDetails: details.results });
});

// POST /api/vehicles/:vehicleId/consumptions - create consumption record
consumptions.post('/:vehicleId/consumptions', async (c) => {
  const db = c.env.DB;
  const vehicleId = c.req.param('vehicleId');

  // Check vehicle exists and get type
  const vehicle = await db
    .prepare('SELECT id, type FROM vehicles WHERE id = ?')
    .bind(vehicleId)
    .first<{ id: string; type: string }>();
  if (!vehicle) {
    return c.json({ error: '车辆不存在' }, 404);
  }

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: '请求体格式错误' }, 400);
  }

  // Validate and extract fields
  const errors = validateConsumptionBody(body, vehicle.type as VehicleType);
  if (Object.keys(errors).length > 0) {
    return c.json({ error: '验证失败', fields: errors }, 400);
  }

  const {
    recordTime,
    mileage,
    fuelType,
    quantity,
    unitPrice,
    totalPrice,
    chargingType,
    chargingCurrent,
    chargingPhase,
    batteryBefore,
    batteryAfter,
    estimatedRange,
    remainingRangeKm,
    displayConsumption,
    consumedKwh,
    fullChargeRangeKm,
    vehicleDisplayedKwh,
    chargerDisplayedKwh,
    chargingStation,
    note,
    locationId,
    electricityDetails,
  } = body;

  // Compute totalPrice or unitPrice if needed
  let finalUnitPrice = unitPrice;
  let finalTotalPrice = totalPrice;
  if (totalPrice !== undefined && totalPrice !== null && !unitPrice) {
    finalUnitPrice = calculateUnitPrice(totalPrice, quantity);
    finalTotalPrice = totalPrice;
  } else if (unitPrice && (totalPrice === undefined || totalPrice === null)) {
    finalTotalPrice = Math.round(unitPrice * quantity * 100) / 100;
  }

  const isElectric = fuelType === 'electric';

  // Validate locationId if provided
  if (locationId) {
    const loc = await db
      .prepare('SELECT id FROM locations WHERE id = ?')
      .bind(locationId)
      .first();
    if (!loc) {
      return c.json({ error: '地点不存在', field: 'locationId' }, 400);
    }
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  try {
    // Insert consumption record
    await db
      .prepare(
        `INSERT INTO consumptions (id, vehicleId, recordTime, mileage, fuelType, quantity, unitPrice, totalPrice, chargingType, chargingCurrent, chargingPhase, batteryBefore, batteryAfter, estimatedRange, remainingRangeKm, displayConsumption, consumedKwh, fullChargeRangeKm, vehicleDisplayedKwh, chargerDisplayedKwh, chargingStation, note, locationId, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        vehicleId,
        recordTime,
        mileage,
        fuelType,
        quantity,
        finalUnitPrice,
        finalTotalPrice || null,
        isElectric ? (chargingType || null) : null,
        isElectric ? (chargingCurrent || null) : null,
        isElectric ? (chargingPhase || 'single') : null,
        isElectric ? (batteryBefore ?? null) : null,
        isElectric ? (batteryAfter ?? null) : null,
        isElectric ? (estimatedRange ?? null) : null,
        isElectric ? (remainingRangeKm ?? null) : null,
        isElectric ? (displayConsumption ?? null) : null,
        isElectric ? (consumedKwh ?? null) : null,
        isElectric ? (fullChargeRangeKm ?? null) : null,
        isElectric ? (vehicleDisplayedKwh ?? null) : null,
        isElectric ? (chargerDisplayedKwh ?? null) : null,
        isElectric ? (chargingStation?.trim() || null) : null,
        note?.trim() || null,
        locationId || null,
        now,
        now
      )
      .run();

    // Insert electricity details if electric
    if (isElectric && electricityDetails && electricityDetails.length > 0) {
      for (let i = 0; i < electricityDetails.length; i++) {
        const detail = electricityDetails[i];
        const detailId = crypto.randomUUID();
        await db
          .prepare(
            `INSERT INTO consumption_electricity_details (id, consumptionId, quantity, unitPrice, sortOrder)
             VALUES (?, ?, ?, ?, ?)`
          )
          .bind(detailId, id, detail.quantity, detail.unitPrice, i)
          .run();
      }
    }

    const created = await db.prepare('SELECT * FROM consumptions WHERE id = ?').bind(id).first<any>();

    // Attach electricity details to the response
    if (isElectric) {
      const details = await db
        .prepare('SELECT * FROM consumption_electricity_details WHERE consumptionId = ? ORDER BY sortOrder')
        .bind(id)
        .all();
      created.electricityDetails = details.results;
    }

    return c.json(created, 201);
  } catch (error) {
    return c.json({ error: '创建能耗记录失败' }, 500);
  }
});

// PUT /api/consumptions/:id - edit consumption record
consumptions.put('/:id', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');

  const existing = await db
    .prepare(
      `SELECT c.*, v.type AS vehicleType FROM consumptions c
       JOIN vehicles v ON v.id = c.vehicleId
       WHERE c.id = ?`
    )
    .bind(id)
    .first<any>();

  if (!existing) {
    return c.json({ error: '能耗记录不存在' }, 404);
  }

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: '请求体格式错误' }, 400);
  }

  const vehicleType = existing.vehicleType as VehicleType;
  const errors = validateConsumptionBody(body, vehicleType);
  if (Object.keys(errors).length > 0) {
    return c.json({ error: '验证失败', fields: errors }, 400);
  }

  const {
    recordTime,
    mileage,
    fuelType,
    quantity,
    unitPrice,
    totalPrice,
    chargingType,
    chargingCurrent,
    chargingPhase,
    batteryBefore,
    batteryAfter,
    estimatedRange,
    remainingRangeKm,
    displayConsumption,
    consumedKwh,
    fullChargeRangeKm,
    vehicleDisplayedKwh,
    chargerDisplayedKwh,
    chargingStation,
    note,
    locationId,
    electricityDetails,
  } = body;

  // Compute totalPrice or unitPrice if needed
  let finalUnitPrice = unitPrice;
  let finalTotalPrice = totalPrice;
  if (totalPrice !== undefined && totalPrice !== null && !unitPrice) {
    finalUnitPrice = calculateUnitPrice(totalPrice, quantity);
    finalTotalPrice = totalPrice;
  } else if (unitPrice && (totalPrice === undefined || totalPrice === null)) {
    finalTotalPrice = Math.round(unitPrice * quantity * 100) / 100;
  }

  const isElectric = fuelType === 'electric';

  if (locationId) {
    const loc = await db
      .prepare('SELECT id FROM locations WHERE id = ?')
      .bind(locationId)
      .first();
    if (!loc) {
      return c.json({ error: '地点不存在', field: 'locationId' }, 400);
    }
  }

  const now = new Date().toISOString();

  try {
    await db
      .prepare(
        `UPDATE consumptions SET recordTime = ?, mileage = ?, fuelType = ?, quantity = ?, unitPrice = ?, totalPrice = ?, chargingType = ?, chargingCurrent = ?, chargingPhase = ?, batteryBefore = ?, batteryAfter = ?, estimatedRange = ?, remainingRangeKm = ?, displayConsumption = ?, consumedKwh = ?, fullChargeRangeKm = ?, vehicleDisplayedKwh = ?, chargerDisplayedKwh = ?, chargingStation = ?, note = ?, locationId = ?, updatedAt = ?
         WHERE id = ?`
      )
      .bind(
        recordTime,
        mileage,
        fuelType,
        quantity,
        finalUnitPrice,
        finalTotalPrice || null,
        isElectric ? (chargingType || null) : null,
        isElectric ? (chargingCurrent || null) : null,
        isElectric ? (chargingPhase || 'single') : null,
        isElectric ? (batteryBefore ?? null) : null,
        isElectric ? (batteryAfter ?? null) : null,
        isElectric ? (estimatedRange ?? null) : null,
        isElectric ? (remainingRangeKm ?? null) : null,
        isElectric ? (displayConsumption ?? null) : null,
        isElectric ? (consumedKwh ?? null) : null,
        isElectric ? (fullChargeRangeKm ?? null) : null,
        isElectric ? (vehicleDisplayedKwh ?? null) : null,
        isElectric ? (chargerDisplayedKwh ?? null) : null,
        isElectric ? (chargingStation?.trim() || null) : null,
        note?.trim() || null,
        locationId || null,
        now,
        id
      )
      .run();

    // Replace electricity details
    await db
      .prepare('DELETE FROM consumption_electricity_details WHERE consumptionId = ?')
      .bind(id)
      .run();

    if (isElectric && electricityDetails && electricityDetails.length > 0) {
      for (let i = 0; i < electricityDetails.length; i++) {
        const detail = electricityDetails[i];
        const detailId = crypto.randomUUID();
        await db
          .prepare(
            `INSERT INTO consumption_electricity_details (id, consumptionId, quantity, unitPrice, sortOrder)
             VALUES (?, ?, ?, ?, ?)`
          )
          .bind(detailId, id, detail.quantity, detail.unitPrice, i)
          .run();
      }
    }

    const updated = await db.prepare('SELECT * FROM consumptions WHERE id = ?').bind(id).first();
    return c.json(updated);
  } catch (error) {
    return c.json({ error: '更新能耗记录失败' }, 500);
  }
});

// DELETE /api/consumptions/:id
consumptions.delete('/:id', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');

  try {
    const result = await db.prepare('DELETE FROM consumptions WHERE id = ?').bind(id).run();
    if (!result.meta.changes) {
      return c.json({ error: '能耗记录不存在' }, 404);
    }
    return c.json({ success: true, id });
  } catch (error) {
    return c.json({ error: '删除能耗记录失败' }, 500);
  }
});

// ============================================================
// Validation Helper
// ============================================================

function validateConsumptionBody(body: any, vehicleType: VehicleType): Record<string, string> {
  const errors: Record<string, string> = {};

  // recordTime
  if (!body.recordTime || typeof body.recordTime !== 'string') {
    errors['recordTime'] = '请输入记录时间';
  }

  // mileage
  if (body.mileage === undefined || body.mileage === null) {
    errors['mileage'] = '请输入当前里程';
  } else if (typeof body.mileage !== 'number' || isNaN(body.mileage)) {
    errors['mileage'] = '里程格式错误';
  } else if (body.mileage < MILEAGE_MIN || body.mileage > MILEAGE_MAX) {
    errors['mileage'] = `里程必须在${MILEAGE_MIN}至${MILEAGE_MAX}之间`;
  }

  // fuelType compatibility
  const validFuelTypes: FuelType[] = ['gasoline', 'diesel', 'electric'];
  if (!body.fuelType || !validFuelTypes.includes(body.fuelType)) {
    errors['fuelType'] = '燃料类型无效';
  } else if (!isFuelTypeCompatible(body.fuelType, vehicleType)) {
    errors['fuelType'] = vehicleType === 'fuel'
      ? '燃油车只能选择汽油或柴油'
      : vehicleType === 'electric'
        ? '电动车只能选择电'
        : `燃料类型"${body.fuelType}"与车辆类型不兼容`;
  }

  // quantity
  if (body.quantity === undefined || body.quantity === null) {
    errors['quantity'] = '请输入加注量';
  } else if (typeof body.quantity !== 'number' || isNaN(body.quantity)) {
    errors['quantity'] = '加注量格式错误';
  } else if (body.quantity < QUANTITY_MIN || body.quantity > QUANTITY_MAX) {
    errors['quantity'] = `加注量必须在${QUANTITY_MIN}至${QUANTITY_MAX}之间`;
  }

  // unitPrice (optional if totalPrice provided)
  if (body.unitPrice !== undefined && body.unitPrice !== null) {
    if (typeof body.unitPrice !== 'number' || isNaN(body.unitPrice)) {
      errors['unitPrice'] = '请输入有效的单价';
    } else if (body.unitPrice < UNIT_PRICE_MIN || body.unitPrice > UNIT_PRICE_MAX) {
      errors['unitPrice'] = `单价必须在${UNIT_PRICE_MIN}至${UNIT_PRICE_MAX}之间`;
    }
  } else if (body.totalPrice === undefined || body.totalPrice === null) {
    errors['unitPrice'] = '请输入单价或总价';
  }

  // Electric-specific validations
  if (body.fuelType === 'electric' && !errors['fuelType']) {
    // batteryBefore
    if (body.batteryBefore === undefined || body.batteryBefore === null) {
      errors['batteryBefore'] = '请输入充电前电量百分比';
    } else if (
      !Number.isInteger(body.batteryBefore) ||
      body.batteryBefore < BATTERY_PERCENT_MIN ||
      body.batteryBefore > BATTERY_PERCENT_MAX
    ) {
      errors['batteryBefore'] = '充电前电量百分比必须为0-100的整数';
    }

    // batteryAfter
    if (body.batteryAfter === undefined || body.batteryAfter === null) {
      errors['batteryAfter'] = '请输入充电后电量百分比';
    } else if (
      !Number.isInteger(body.batteryAfter) ||
      body.batteryAfter < BATTERY_PERCENT_MIN ||
      body.batteryAfter > BATTERY_PERCENT_MAX
    ) {
      errors['batteryAfter'] = '充电后电量百分比必须为0-100的整数';
    }

    if (
      !errors['batteryBefore'] &&
      !errors['batteryAfter'] &&
      body.batteryAfter <= body.batteryBefore
    ) {
      errors['batteryAfter'] = '充电后电量百分比必须大于充电前电量百分比';
    }

    // chargingType validation
    if (body.chargingType) {
      const validChargingTypes: ChargingType[] = ['dc', 'ac'];
      if (!validChargingTypes.includes(body.chargingType)) {
        errors['chargingType'] = '充电类型必须为直流(dc)或交流(ac)';
      }

      // chargingCurrent (optional; both AC and DC accepted)
      if (body.chargingCurrent !== undefined && body.chargingCurrent !== null) {
        if (
          typeof body.chargingCurrent !== 'number' ||
          body.chargingCurrent < CHARGING_CURRENT_MIN ||
          body.chargingCurrent > CHARGING_CURRENT_MAX
        ) {
          errors['chargingCurrent'] = `充电电流必须在${CHARGING_CURRENT_MIN}至${CHARGING_CURRENT_MAX}A之间`;
        }
      }
    }

    // estimatedRange
    if (body.estimatedRange !== undefined && body.estimatedRange !== null) {
      if (
        typeof body.estimatedRange !== 'number' ||
        body.estimatedRange < ESTIMATED_RANGE_MIN ||
        body.estimatedRange > ESTIMATED_RANGE_MAX
      ) {
        errors['estimatedRange'] = `预计续航必须在${ESTIMATED_RANGE_MIN}至${ESTIMATED_RANGE_MAX}km之间`;
      }
    }

    // electricityDetails (1-10 groups)
    if (!body.electricityDetails || !Array.isArray(body.electricityDetails) || body.electricityDetails.length === 0) {
      errors['electricityDetails'] = `请至少添加${ELECTRICITY_DETAILS_MIN_GROUPS}组电量明细`;
    } else if (body.electricityDetails.length > ELECTRICITY_DETAILS_MAX_GROUPS) {
      errors['electricityDetails'] = `电量明细最多${ELECTRICITY_DETAILS_MAX_GROUPS}组`;
    } else {
      // Validate each detail group
      for (let i = 0; i < body.electricityDetails.length; i++) {
        const detail = body.electricityDetails[i];
        if (!detail || typeof detail.quantity !== 'number' || detail.quantity < QUANTITY_MIN || detail.quantity > QUANTITY_MAX) {
          errors[`electricityDetails[${i}].quantity`] = `第${i + 1}组电量数值无效`;
        }
        if (!detail || typeof detail.unitPrice !== 'number' || detail.unitPrice < UNIT_PRICE_MIN || detail.unitPrice > UNIT_PRICE_MAX) {
          errors[`electricityDetails[${i}].unitPrice`] = `第${i + 1}组单价数值无效`;
        }
      }
    }
  }

  // vehicleDisplayedKwh / chargerDisplayedKwh: optional, electric only
  const displayKwhFields = ['vehicleDisplayedKwh', 'chargerDisplayedKwh'] as const;
  for (const field of displayKwhFields) {
    const value = body[field];
    if (value !== undefined && value !== null && value !== '') {
      if (body.fuelType !== 'electric') {
        errors[field] = '仅电车记录可填写显示充电电量';
      } else if (
        typeof value !== 'number' ||
        isNaN(value) ||
        value < QUANTITY_MIN ||
        value > QUANTITY_MAX
      ) {
        errors[field] = `显示充电电量必须在${QUANTITY_MIN}至${QUANTITY_MAX}kWh之间`;
      }
    }
  }

  // Optional electric-only extras from 小熊油耗 import & manual entry
  const electricExtras: Array<[string, number, number]> = [
    ['remainingRangeKm', 0, 9999.9],
    ['displayConsumption', 0, 99.9],
    ['consumedKwh', 0, 9999.99],
    ['fullChargeRangeKm', 0, 9999.9],
  ];
  for (const [field, min, max] of electricExtras) {
    const value = body[field];
    if (value !== undefined && value !== null && value !== '') {
      if (body.fuelType !== 'electric') {
        errors[field] = '仅电车记录可填写该字段';
      } else if (typeof value !== 'number' || isNaN(value) || value < min || value > max) {
        errors[field] = `数值必须在${min}至${max}之间`;
      }
    }
  }

  if (
    body.chargingPhase !== undefined &&
    body.chargingPhase !== null &&
    body.chargingPhase !== ''
  ) {
    if (body.fuelType !== 'electric') {
      errors['chargingPhase'] = '仅电车记录可填写电流相数';
    } else if (!['single', 'three'].includes(body.chargingPhase)) {
      errors['chargingPhase'] = '电流相数必须为单相(single)或三相(three)';
    }
  }

  if (body.chargingStation !== undefined && body.chargingStation !== null) {
    if (typeof body.chargingStation !== 'string' || body.chargingStation.trim().length > 100) {
      errors['chargingStation'] = '充电站名称不能超过100个字符';
    } else if (body.chargingStation.trim() && body.fuelType !== 'electric') {
      errors['chargingStation'] = '仅电车记录可填写充电站';
    }
  }

  if (body.note !== undefined && body.note !== null) {
    if (typeof body.note !== 'string' || body.note.length > 500) {
      errors['note'] = '备注不能超过500个字符';
    }
  }

  return errors;
}

export default consumptions;
