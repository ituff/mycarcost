/**
 * Calculation utilities: unit price, per-100km consumption,
 * expense amortization and periodic expense generation.
 */

/** 单价 = 总价 / 数量，保留 3 位小数 */
export function calculateUnitPrice(totalPrice: number, quantity: number): number {
  if (!quantity || quantity <= 0) return 0;
  return Math.round((totalPrice / quantity) * 1000) / 1000;
}

/** 百公里能耗 = 数量 / 距离(km) * 100，保留 1 位小数 */
export function calculatePer100km(quantity: number, distanceKm: number): number {
  if (!distanceKm || distanceKm <= 0) return 0;
  return Math.round((quantity / distanceKm) * 100 * 10) / 10;
}

/** 每公里成本 = 总费用 / 总距离(km)，保留 2 位小数；距离为 0 时返回 null */
export function calculateCostPerKm(totalCost: number, totalDistanceKm: number): number | null {
  if (!totalDistanceKm || totalDistanceKm <= 0) return null;
  return Math.round((totalCost / totalDistanceKm) * 100) / 100;
}

/**
 * 分摊费用：把一笔金额按月均摊。
 * 从 startDate 所在月开始，共 months 个月，每月金额保留 2 位小数，
 * 由于四舍五入产生的差额补到第一期。
 */
export function amortizeExpense(
  amount: number,
  months: number,
  startDate: string
): { month: string; amount: number }[] {
  if (months <= 0 || amount <= 0) return [];

  const perMonth = Math.floor((amount / months) * 100) / 100;
  // 第一期补上四舍五入差额，保证总额一致
  const firstMonthAmount = Math.round((amount - perMonth * (months - 1)) * 100) / 100;

  const start = new Date(startDate + 'T00:00:00Z');
  const entries: { month: string; amount: number }[] = [];

  for (let i = 0; i < months; i++) {
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
    const month = d.toISOString().slice(0, 7);
    entries.push({ month, amount: i === 0 ? firstMonthAmount : perMonth });
  }

  return entries;
}

/**
 * 周期费用展开：在起止日期之间按 daily/monthly 周期生成逐期条目。
 * monthly 以自然月对齐（每月同一天，超出月末取月末）。
 */
export function generatePeriodicEntries(
  amount: number,
  period: 'daily' | 'monthly',
  startDate: string,
  endDate: string
): { date: string; amount: number }[] {
  const entries: { date: string; amount: number }[] = [];
  if (amount <= 0 || !startDate || !endDate || endDate < startDate) return entries;

  const start = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');

  if (period === 'daily') {
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      entries.push({ date: d.toISOString().slice(0, 10), amount });
    }
    return entries;
  }

  // monthly: align to the start day-of-month, clamped to month end
  const dayOfMonth = start.getUTCDate();

  let i = 0;
  for (;;) {
    const totalMonth = start.getUTCMonth() + i;
    const y = start.getUTCFullYear() + Math.floor(totalMonth / 12);
    const m = totalMonth % 12;
    const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const day = Math.min(dayOfMonth, lastDay);
    const date = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (date > endDate) break;
    entries.push({ date, amount });
    i++;
  }

  return entries;
}
