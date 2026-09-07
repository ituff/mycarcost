import { Hono } from 'hono';
import type { Env } from '../index';

interface SyncOperation {
  tableName: string;
  operation: 'create' | 'update' | 'delete';
  recordId: string;
  record?: any;
}

const sync = new Hono<{ Bindings: Env }>();

// POST /api/sync - batch sync with LWW conflict resolution
sync.post('/', async (c) => {
  const db = c.env.DB;

  let body: { operations: SyncOperation[] };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: '请求体格式错误' }, 400);
  }

  if (!body.operations || !Array.isArray(body.operations)) {
    return c.json({ error: 'operations字段必须为数组' }, 400);
  }

  const results: { recordId: string; status: 'synced' | 'conflict' | 'error'; message?: string }[] = [];
  let conflictCount = 0;

  const validTables = ['vehicles', 'consumptions', 'consumption_electricity_details', 'locations', 'expense_types', 'expenses', 'periodic_expenses', 'incomes'];

  for (const op of body.operations) {
    if (!validTables.includes(op.tableName)) {
      results.push({ recordId: op.recordId, status: 'error', message: '无效的表名' });
      continue;
    }

    try {
      if (op.operation === 'delete') {
        const existing = await db
          .prepare(`SELECT * FROM ${op.tableName} WHERE id = ?`)
          .bind(op.recordId)
          .first();
        if (existing) {
          await archiveRecord(db, op.tableName, op.recordId, existing);
          await db.prepare(`DELETE FROM ${op.tableName} WHERE id = ?`).bind(op.recordId).run();
        }
        results.push({ recordId: op.recordId, status: 'synced' });
        continue;
      }

      if (!op.record) {
        results.push({ recordId: op.recordId, status: 'error', message: '缺少record数据' });
        continue;
      }

      const existing = await db
        .prepare(`SELECT id, updatedAt FROM ${op.tableName} WHERE id = ?`)
        .bind(op.recordId)
        .first<{ id: string; updatedAt: string }>();

      if (existing) {
        // LWW: server wins if strictly newer than the incoming record
        const incoming = op.record.updatedAt || '';
        if (existing.updatedAt && existing.updatedAt >= incoming) {
          await archiveRecord(db, op.tableName, op.recordId, op.record);
          conflictCount++;
          results.push({ recordId: op.recordId, status: 'conflict' });
          continue;
        }
        await updateRecord(db, op.tableName, op.recordId, op.record);
        results.push({ recordId: op.recordId, status: 'synced' });
      } else {
        await insertRecord(db, op.tableName, op.record);
        results.push({ recordId: op.recordId, status: 'synced' });
      }
    } catch (error) {
      results.push({ recordId: op.recordId, status: 'error', message: '同步失败' });
    }
  }

  return c.json({
    success: true,
    syncedCount: results.filter((r) => r.status === 'synced').length,
    conflictCount,
    results,
  });
});

// GET /api/sync/status - server data versions for client comparison
sync.get('/status', async (c) => {
  const db = c.env.DB;

  const tables = ['vehicles', 'consumptions', 'locations', 'expense_types', 'expenses', 'periodic_expenses', 'incomes'];
  const versions: Record<string, string | null> = {};

  for (const table of tables) {
    const result = await db
      .prepare(`SELECT MAX(updatedAt) AS lastUpdated FROM ${table}`)
      .first<{ lastUpdated: string | null }>();
    versions[table] = result?.lastUpdated || null;
  }

  return c.json({ versions, serverTime: new Date().toISOString() });
});

async function archiveRecord(db: Env['DB'], tableName: string, recordId: string, data: any) {
  await db
    .prepare(
      `INSERT OR REPLACE INTO conflict_archive (id, tableName, recordId, data, archivedAt)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(crypto.randomUUID(), tableName, recordId, JSON.stringify(data), new Date().toISOString())
    .run();
}

async function insertRecord(db: Env['DB'], tableName: string, record: any) {
  const entries = Object.entries(record).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return;
  const cols = entries.map(([k]) => k);
  const placeholders = cols.map(() => '?').join(', ');
  await db
    .prepare(`INSERT OR REPLACE INTO ${tableName} (${cols.join(', ')}) VALUES (${placeholders})`)
    .bind(...entries.map(([, v]) => v as any))
    .run();
}

async function updateRecord(db: Env['DB'], tableName: string, recordId: string, record: any) {
  const entries = Object.entries(record).filter(([k, v]) => k !== 'id' && v !== undefined);
  if (entries.length === 0) return;
  const sets = entries.map(([k]) => `${k} = ?`).join(', ');
  await db
    .prepare(`UPDATE ${tableName} SET ${sets} WHERE id = ?`)
    .bind(...entries.map(([, v]) => v as any), recordId)
    .run();
}

export default sync;
