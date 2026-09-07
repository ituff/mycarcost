import { Hono } from 'hono';
import type { Env } from '../index';

const settings = new Hono<{ Bindings: Env }>();

// GET /api/settings - retrieve all settings
settings.get('/', async (c) => {
  const db = c.env.DB;

  const results = await db
    .prepare('SELECT key, value FROM settings')
    .all();

  const settingsMap: Record<string, string> = {};
  for (const row of results.results as any[]) {
    // Never expose auth internals (password hash, session secret)
    if (row.key === 'auth_password' || row.key === 'auth_secret') {
      continue;
    }
    // Mask API key for security
    if (row.key === 'llm_api_key' && row.value) {
      settingsMap[row.key] = row.value.slice(0, 4) + '****' + row.value.slice(-4);
    } else {
      settingsMap[row.key] = row.value;
    }
  }

  return c.json(settingsMap);
});

// PUT /api/settings - update settings
settings.put('/', async (c) => {
  const db = c.env.DB;

  let body: Record<string, string>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: '请求体格式错误' }, 400);
  }

  const allowedKeys = ['llm_api_url', 'llm_api_key', 'llm_model'];

  try {
    for (const [key, value] of Object.entries(body)) {
      if (!allowedKeys.includes(key)) {
        continue;
      }

      // Upsert: INSERT OR REPLACE
      await db
        .prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
        .bind(key, value || '')
        .run();
    }

    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: '更新设置失败' }, 500);
  }
});

export default settings;
