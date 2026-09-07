import { Hono } from 'hono';
import type { Env } from '../index';
import { calculatePer100km, calculateCostPerKm } from '@mycarcost/shared';

const reports = new Hono<{ Bindings: Env }>();

// GET /api/vehicles/:vehicleId/reports/consumption - consumption analysis
reports.get('/:vehicleId/reports/consumption', async (c) => {
  const db = c.env.DB;
  const vehicleId = c.req.param('vehicleId');

  // Check vehicle exists
  const vehicle = await db
    .prepare('SELECT id, type FROM vehicles WHERE id = ?')
    .bind(vehicleId)
    .first<{ id: string; type: string }>();
  if (!vehicle) {
    return c.json({ error: '车辆不存在' }, 404);
  }

  // Time range: all=1 means the vehicle's entire history (no date filter);
  // otherwise defaults to the last 6 months.
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth() - 6, 1);
  const isAll = c.req.query('all') === '1';
  const startDate = c.req.query('startDate') || defaultStart.toISOString().split('T')[0];
  const endDate = c.req.query('endDate') || now.toISOString().split('T')[0];

  // Fetch consumption records sorted by mileage to calculate distance between records
  const records = isAll
    ? await db
        .prepare(
          `SELECT id, recordTime, mileage, fuelType, quantity, unitPrice, totalPrice
           FROM consumptions
           WHERE vehicleId = ?
           ORDER BY mileage ASC`
        )
        .bind(vehicleId)
        .all()
    : await db
        .prepare(
          `SELECT id, recordTime, mileage, fuelType, quantity, unitPrice, totalPrice
           FROM consumptions
           WHERE vehicleId = ? AND recordTime >= ? AND recordTime <= ?
           ORDER BY mileage ASC`
        )
        .bind(vehicleId, startDate, endDate + 'T23:59:59')
        .all();

  const allRecords = records.results as any[];

  if (allRecords.length === 0) {
    return c.json({
      vehicleId,
      vehicleType: vehicle.type,
      period: isAll ? null : { startDate, endDate },
      summary: { recordCount: 0, firstRecord: null, lastRecord: null },
      fuel: { averagePer100km: null, totalQuantity: 0, totalCost: 0, dataPoints: [] },
      electric: { averagePer100km: null, totalQuantity: 0, totalCost: 0, dataPoints: [] },
    });
  }

  // Calculate per-100km for each pair of consecutive records by fuel type
  const fuelRecords = allRecords.filter((r) => r.fuelType !== 'electric');
  const electricRecords = allRecords.filter((r) => r.fuelType === 'electric');

  const fuelDataPoints = calculateDataPoints(fuelRecords);
  const electricDataPoints = calculateDataPoints(electricRecords);

  // Calculate averages
  const fuelAvg = fuelDataPoints.length > 0
    ? Math.round(fuelDataPoints.reduce((sum, dp) => sum + dp.per100km, 0) / fuelDataPoints.length * 10) / 10
    : null;

  const electricAvg = electricDataPoints.length > 0
    ? Math.round(electricDataPoints.reduce((sum, dp) => sum + dp.per100km, 0) / electricDataPoints.length * 10) / 10
    : null;

  const fuelTotalQuantity = fuelRecords.reduce((sum, r) => sum + (r.quantity || 0), 0);
  const fuelTotalCost = fuelRecords.reduce((sum, r) => sum + (r.totalPrice || r.unitPrice * r.quantity || 0), 0);
  const electricTotalQuantity = electricRecords.reduce((sum, r) => sum + (r.quantity || 0), 0);
  const electricTotalCost = electricRecords.reduce((sum, r) => sum + (r.totalPrice || r.unitPrice * r.quantity || 0), 0);

  // Time-ordered records for overview stats (first/last record of the period)
  const timeOrdered = [...allRecords].sort((a, b) => a.recordTime.localeCompare(b.recordTime));
  const summary = {
    recordCount: allRecords.length,
    firstRecord: timeOrdered.length
      ? { recordTime: timeOrdered[0].recordTime, mileage: timeOrdered[0].mileage }
      : null,
    lastRecord: timeOrdered.length
      ? {
          recordTime: timeOrdered[timeOrdered.length - 1].recordTime,
          mileage: timeOrdered[timeOrdered.length - 1].mileage,
        }
      : null,
  };

  return c.json({
    vehicleId,
    vehicleType: vehicle.type,
    period: isAll ? null : { startDate, endDate },
    summary,
    fuel: {
      averagePer100km: fuelAvg,
      totalQuantity: Math.round(fuelTotalQuantity * 100) / 100,
      totalCost: Math.round(fuelTotalCost * 100) / 100,
      dataPoints: fuelDataPoints,
    },
    electric: {
      averagePer100km: electricAvg,
      totalQuantity: Math.round(electricTotalQuantity * 100) / 100,
      totalCost: Math.round(electricTotalCost * 100) / 100,
      dataPoints: electricDataPoints,
    },
  });
});

// GET /api/vehicles/:vehicleId/reports/expense - expense analysis
reports.get('/:vehicleId/reports/expense', async (c) => {
  const db = c.env.DB;
  const vehicleId = c.req.param('vehicleId');

  // Check vehicle exists
  const vehicle = await db
    .prepare('SELECT id, type FROM vehicles WHERE id = ?')
    .bind(vehicleId)
    .first<{ id: string; type: string }>();
  if (!vehicle) {
    return c.json({ error: '车辆不存在' }, 404);
  }

  // Default time range: last 12 months; all=1 covers the vehicle's entire history
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth() - 12, 1);
  const isAll = c.req.query('all') === '1';
  const startDate = isAll ? '2000-01-01' : (c.req.query('startDate') || defaultStart.toISOString().split('T')[0]);
  const endDate = isAll ? '2099-12-31' : (c.req.query('endDate') || now.toISOString().split('T')[0]);

  // Expense breakdown by type
  const breakdownResult = await db
    .prepare(
      `SELECT et.id AS typeId, et.name AS typeName, et.color AS typeColor, SUM(e.amount) AS totalAmount
       FROM expenses e
       JOIN expense_types et ON et.id = e.expenseTypeId
       WHERE e.vehicleId = ? AND e.date >= ? AND e.date <= ?
       GROUP BY et.id
       ORDER BY totalAmount DESC`
    )
    .bind(vehicleId, startDate, endDate)
    .all();

  // Add consumption costs to breakdown
  const consumptionCostResult = await db
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN totalPrice IS NOT NULL THEN totalPrice ELSE unitPrice * quantity END), 0) AS totalCost
       FROM consumptions
       WHERE vehicleId = ? AND recordTime >= ? AND recordTime <= ?`
    )
    .bind(vehicleId, startDate, endDate + 'T23:59:59')
    .first<{ totalCost: number }>();

  // Monthly expense trend
  const monthlyResult = await db
    .prepare(
      `SELECT substr(e.date, 1, 7) AS month, SUM(e.amount) AS totalAmount
       FROM expenses e
       WHERE e.vehicleId = ? AND e.date >= ? AND e.date <= ?
       GROUP BY substr(e.date, 1, 7)
       ORDER BY month ASC`
    )
    .bind(vehicleId, startDate, endDate)
    .all();

  // Monthly consumption cost trend
  const monthlyConsumptionResult = await db
    .prepare(
      `SELECT substr(recordTime, 1, 7) AS month,
              SUM(CASE WHEN totalPrice IS NOT NULL THEN totalPrice ELSE unitPrice * quantity END) AS totalCost
       FROM consumptions
       WHERE vehicleId = ? AND recordTime >= ? AND recordTime <= ?
       GROUP BY substr(recordTime, 1, 7)
       ORDER BY month ASC`
    )
    .bind(vehicleId, startDate, endDate + 'T23:59:59')
    .all();

  // Merge monthly data
  const monthlyMap: Record<string, number> = {};
  for (const row of monthlyResult.results as any[]) {
    monthlyMap[row.month] = (monthlyMap[row.month] || 0) + row.totalAmount;
  }
  for (const row of monthlyConsumptionResult.results as any[]) {
    monthlyMap[row.month] = (monthlyMap[row.month] || 0) + row.totalCost;
  }

  const monthlyTrend = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, amount]) => ({ month, amount: Math.round(amount * 100) / 100 }));

  // 月度 × 类别（含油费/电费），用于堆叠柱状图
  const monthlyExpenseByType = await db
    .prepare(
      `SELECT substr(e.date, 1, 7) AS month, et.id AS typeId, et.name AS typeName, et.color AS typeColor,
              SUM(e.amount) AS amount
       FROM expenses e
       JOIN expense_types et ON et.id = e.expenseTypeId
       WHERE e.vehicleId = ? AND e.date >= ? AND e.date <= ?
       GROUP BY month, et.id
       ORDER BY month ASC`
    )
    .bind(vehicleId, startDate, endDate)
    .all();

  const monthlyConsumptionByType = await db
    .prepare(
      `SELECT substr(recordTime, 1, 7) AS month, fuelType,
              SUM(COALESCE(totalPrice, unitPrice * quantity)) AS amount
       FROM consumptions
       WHERE vehicleId = ? AND recordTime >= ? AND recordTime <= ?
       GROUP BY month, fuelType
       ORDER BY month ASC`
    )
    .bind(vehicleId, startDate, endDate + 'T23:59:59')
    .all();

  const monthlyByType = [
    ...(monthlyExpenseByType.results as any[]).map((r) => ({
      month: r.month,
      typeId: r.typeId,
      typeName: r.typeName,
      typeColor: r.typeColor,
      amount: Math.round(r.amount * 100) / 100,
    })),
    ...(monthlyConsumptionByType.results as any[]).map((r) => ({
      month: r.month,
      typeId: r.fuelType === 'electric' ? '_electric' : '_fuel',
      typeName: r.fuelType === 'electric' ? '电费' : '油费',
      typeColor: r.fuelType === 'electric' ? '#10b981' : '#3B82F6',
      amount: Math.round(r.amount * 100) / 100,
    })),
  ];

  // Cost per kilometer
  const maxMileageResult = await db
    .prepare(
      `SELECT MAX(mileage) AS maxMileage, MIN(mileage) AS minMileage
       FROM consumptions
       WHERE vehicleId = ? AND recordTime >= ? AND recordTime <= ?`
    )
    .bind(vehicleId, startDate, endDate + 'T23:59:59')
    .first<{ maxMileage: number | null; minMileage: number | null }>();

  const totalDistance = (maxMileageResult?.maxMileage || 0) - (maxMileageResult?.minMileage || 0);
  const totalExpenseAmount = (breakdownResult.results as any[]).reduce(
    (sum, r) => sum + r.totalAmount, 0
  ) + (consumptionCostResult?.totalCost || 0);

  // 油费/电费拆分（总支出 = 油费 + 电费 + 费用总计）
  const costByFuelResult = await db
    .prepare(
      `SELECT fuelType, SUM(COALESCE(totalPrice, unitPrice * quantity)) AS cost
       FROM consumptions
       WHERE vehicleId = ? AND recordTime >= ? AND recordTime <= ?
       GROUP BY fuelType`
    )
    .bind(vehicleId, startDate, endDate + 'T23:59:59')
    .all();
  const fuelCost = Math.round(((costByFuelResult.results as any[]).find((r) => r.fuelType !== 'electric')?.cost || 0) * 100) / 100;
  const electricCost = Math.round(((costByFuelResult.results as any[]).find((r) => r.fuelType === 'electric')?.cost || 0) * 100) / 100;

  // 记录首末日（费用 ∪ 能耗），用于成本/天
  const rangeResult = await db
    .prepare(
      `SELECT MIN(d) AS firstDate, MAX(d) AS lastDate FROM (
         SELECT date AS d FROM expenses WHERE vehicleId = ? AND date >= ? AND date <= ?
         UNION ALL
         SELECT substr(recordTime, 1, 10) AS d FROM consumptions WHERE vehicleId = ? AND recordTime >= ? AND recordTime <= ?
       )`
    )
    .bind(vehicleId, startDate, endDate, vehicleId, startDate, endDate + 'T23:59:59')
    .first<{ firstDate: string | null; lastDate: string | null }>();

  const incomeResult = await db
    .prepare('SELECT SUM(amount) AS total FROM incomes WHERE vehicleId = ? AND date >= ? AND date <= ?')
    .bind(vehicleId, startDate, endDate)
    .first<{ total: number | null }>();

  const costPerKm = calculateCostPerKm(totalExpenseAmount, totalDistance);

  // Build breakdown with consumption as a special category
  const breakdown = (breakdownResult.results as any[]).map((r) => ({
    typeId: r.typeId,
    typeName: r.typeName,
    typeColor: r.typeColor,
    totalAmount: Math.round(r.totalAmount * 100) / 100,
  }));

  if (consumptionCostResult && consumptionCostResult.totalCost > 0) {
    breakdown.unshift({
      typeId: '_consumption',
      typeName: '能耗费用',
      typeColor: '#3B82F6',
      totalAmount: Math.round(consumptionCostResult.totalCost * 100) / 100,
    });
  }

  return c.json({
    vehicleId,
    vehicleType: vehicle.type,
    period: isAll ? null : { startDate, endDate },
    summary: { firstDate: rangeResult?.firstDate || null, lastDate: rangeResult?.lastDate || null },
    breakdown,
    monthlyTrend,
    monthlyByType,
    fuelCost,
    electricCost,
    totalExpense: Math.round(totalExpenseAmount * 100) / 100,
    totalIncome: Math.round((incomeResult?.total || 0) * 100) / 100,
    totalDistance: Math.round(totalDistance * 10) / 10,
    costPerKm,
  });
});

// ============================================================
// Helper Functions
// ============================================================

interface DataPoint {
  recordTime: string;
  mileage: number;
  quantity: number;
  per100km: number;
}

function calculateDataPoints(records: any[]): DataPoint[] {
  const dataPoints: DataPoint[] = [];

  for (let i = 1; i < records.length; i++) {
    const prev = records[i - 1];
    const curr = records[i];
    const distance = curr.mileage - prev.mileage;

    if (distance > 0) {
      const per100km = calculatePer100km(curr.quantity, distance);
      dataPoints.push({
        recordTime: curr.recordTime,
        mileage: curr.mileage,
        quantity: curr.quantity,
        per100km,
      });
    }
  }

  return dataPoints;
}

export default reports;
