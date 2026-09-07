import type { Env } from './index';

/**
 * 周期费用自动生成：
 * 每次运行检查所有周期费用，把"上次生成日之后、今天（含）之前"到期
 * 的每一期生成为一条费用记录（note 标注周期来源），并推进 lastGeneratedDate。
 * 首次登记不回溯历史（lastGeneratedDate 为空时从今天开始）。
 *
 * 由 Cron Trigger（每天北京时间 00:05）调用，见 wrangler.toml [triggers]。
 */

interface PeriodicRow {
  id: string;
  vehicleId: string;
  expenseTypeId: string;
  amount: number;
  period: 'daily' | 'monthly' | 'yearly';
  startDate: string;
  endDate: string;
  lastGeneratedDate: string | null;
}

function clampedOccurrence(start: Date, monthsLater: number, dayOfMonth: number): string {
  const y = start.getUTCFullYear() + Math.floor((start.getUTCMonth() + monthsLater) / 12);
  const m = (start.getUTCMonth() + monthsLater) % 12;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const day = Math.min(dayOfMonth, lastDay);
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function occurrencesBetween(pe: PeriodicRow, fromDate: string, toDate: string): string[] {
  const start = new Date(pe.startDate + 'T00:00:00Z');
  const out: string[] = [];

  if (pe.period === 'daily') {
    // 严格从 fromDate 的下一天开始（fromDate 当天已生成过）
    const cursor = new Date(fromDate + 'T00:00:00Z');
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const end = new Date(toDate + 'T00:00:00Z');
    for (; cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      out.push(cursor.toISOString().slice(0, 10));
    }
    return out;
  }

  const dayOfMonth = start.getUTCDate();
  if (pe.period === 'monthly') {
    // 从 startDate 所在月开始按月枚举，落在 (fromDate, toDate] 内的即为到期
    const monthsAhead = Math.floor(
      (new Date(toDate + 'T00:00:00Z').getTime() - start.getTime()) / (86400000 * 31)
    ) + 2;
    for (let i = 0; i <= monthsAhead; i++) {
      const date = clampedOccurrence(start, i, dayOfMonth);
      if (date >= pe.startDate && date > fromDate && date <= toDate) out.push(date);
    }
    return out;
  }

  // yearly: 锚定 startDate 的月-日
  const anchorMonth = start.getUTCMonth() + 1;
  const anchorDay = start.getUTCDate();
  const endYear = new Date(toDate + 'T00:00:00Z').getUTCFullYear();
  for (let y = start.getUTCFullYear(); y <= endYear; y++) {
    const lastDay = new Date(Date.UTC(y, anchorMonth, 0)).getUTCDate();
    const day = Math.min(anchorDay, lastDay);
    const date = `${y}-${String(anchorMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (date >= pe.startDate && date > fromDate && date <= toDate) out.push(date);
  }
  return out;
}

export async function generateDuePeriodicExpenses(db: Env['DB'], today = new Date().toISOString().slice(0, 10)): Promise<number> {
  const rows = await db
    .prepare('SELECT * FROM periodic_expenses ORDER BY startDate ASC')
    .all<PeriodicRow>();
  const all = (rows.results || []) as PeriodicRow[];

  let created = 0;

  for (const pe of all) {
    try {
      // 周期已结束且已生成到最后一天：跳过
      const effectiveEnd = pe.endDate < today ? pe.endDate : today;
      if (pe.lastGeneratedDate && pe.lastGeneratedDate >= effectiveEnd) continue;

      // 首次运行不回溯：从今天开始（若今天恰好是到期日则生成今天这期）
      const fromDate = pe.lastGeneratedDate ?? previousDay(today);

      const due = occurrencesBetween(pe, fromDate, effectiveEnd);
      for (const date of due) {
        await db
          .prepare(
            `INSERT INTO expenses (id, vehicleId, expenseTypeId, date, amount, note, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            crypto.randomUUID(),
            pe.vehicleId,
            pe.expenseTypeId,
            date,
            pe.amount,
            `周期费用自动生成（${pe.period === 'daily' ? '每日' : pe.period === 'monthly' ? '每月' : '每年'}）`,
            new Date().toISOString(),
            new Date().toISOString()
          )
          .run();
        created++;
      }

      // 推进进度标记（无论今天是否有到期，都避免重复扫描历史）
      await db
        .prepare('UPDATE periodic_expenses SET lastGeneratedDate = ?, updatedAt = ? WHERE id = ?')
        .bind(effectiveEnd, new Date().toISOString(), pe.id)
        .run();
    } catch (error) {
      console.error('periodic expense generation failed', pe.id, error);
    }
  }

  return created;
}

function previousDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
