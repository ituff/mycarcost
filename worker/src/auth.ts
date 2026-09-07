import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { Env } from './index';
import type { Context, MiddlewareHandler } from 'hono';

const SESSION_COOKIE = 'mcc_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const PBKDF2_ITERATIONS = 100_000;
const MIN_PASSWORD_LENGTH = 6;

// ============================================================
// Crypto helpers
// ============================================================

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function derivePasswordHash(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    keyMaterial,
    256
  );
  return `pbkdf2$${iterations}$${toHex(salt.buffer as ArrayBuffer)}$${toHex(bits)}`;
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return derivePasswordHash(password, salt, PBKDF2_ITERATIONS);
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = parseInt(parts[1], 10);
  const saltHex = parts[2];
  if (!Number.isFinite(iterations) || !/^[0-9a-f]+$/.test(saltHex) || saltHex.length % 2 !== 0) {
    return false;
  }
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
  const computed = await derivePasswordHash(password, salt, iterations);
  return timingSafeEqual(computed, stored);
}

async function getSetting(db: Env['DB'], key: string): Promise<string | null> {
  const row = await db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .bind(key)
    .first<{ value: string }>();
  return row?.value ?? null;
}

async function putSetting(db: Env['DB'], key: string, value: string): Promise<void> {
  await db
    .prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
    .bind(key, value)
    .run();
}

// ============================================================
// Session token: "<expiryMs>.<HMAC-SHA256(secret, "mcc:<expiryMs>") in hex>"
// ============================================================

async function signSession(secret: string, expiryMs: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`mcc:${expiryMs}`));
  return `${expiryMs}.${toHex(sig)}`;
}

async function verifySession(secret: string, token: string): Promise<boolean> {
  const dotIndex = token.indexOf('.');
  if (dotIndex <= 0) return false;
  const expiryMs = parseInt(token.slice(0, dotIndex), 10);
  const sig = token.slice(dotIndex + 1);
  if (!Number.isFinite(expiryMs) || expiryMs < Date.now()) return false;
  const expected = await signSession(secret, expiryMs);
  return timingSafeEqual(expected, token);
}

export async function isAuthenticated(c: Context<{ Bindings: Env }>): Promise<boolean> {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return false;
  const secret = await getSetting(c.env.DB, 'auth_secret');
  if (!secret) return false;
  return verifySession(secret, token);
}

function setSessionCookie(c: Context<{ Bindings: Env }>, token: string): void {
  setCookie(c, SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    secure: new URL(c.req.url).protocol === 'https:',
    sameSite: 'Lax',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

// ============================================================
// Middleware: protect /api/* when a password has been configured
// ============================================================

export const requireAuth: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const path = new URL(c.req.url).pathname;
  // Auth endpoints must stay reachable so users can log in / bootstrap.
  if (path.startsWith('/api/auth') || path === '/api/health') {
    return next();
  }

  const enabled = !!(await getSetting(c.env.DB, 'auth_password'));
  if (!enabled) return next();

  if (await isAuthenticated(c)) return next();
  return c.json({ error: '未登录或会话已过期', authRequired: true }, 401);
};

// ============================================================
// Routes
// ============================================================

const auth = new Hono<{ Bindings: Env }>();

// GET /api/auth/status - public: lets the SPA decide what to render
auth.get('/status', async (c) => {
  const enabled = !!(await getSetting(c.env.DB, 'auth_password'));
  const authenticated = enabled ? await isAuthenticated(c) : true;
  return c.json({ enabled, needsSetup: !enabled, authenticated });
});

// POST /api/auth/setup - first-run only: set the access password
auth.post('/setup', async (c) => {
  const db = c.env.DB;

  if (await getSetting(db, 'auth_password')) {
    return c.json({ error: '访问密码已设置，请直接登录' }, 409);
  }

  let body: { password?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: '请求体格式错误' }, 400);
  }

  const password = body.password;
  if (!password || typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return c.json(
      { error: `密码长度至少 ${MIN_PASSWORD_LENGTH} 个字符`, field: 'password' },
      400
    );
  }

  const hash = await hashPassword(password);
  const secret = toHex(crypto.getRandomValues(new Uint8Array(32)).buffer as ArrayBuffer);
  await putSetting(db, 'auth_password', hash);
  await putSetting(db, 'auth_secret', secret);

  setSessionCookie(c, await signSession(secret, Date.now() + SESSION_TTL_MS));
  return c.json({ success: true });
});

// POST /api/auth/login
auth.post('/login', async (c) => {
  const db = c.env.DB;

  const stored = await getSetting(db, 'auth_password');
  if (!stored) {
    return c.json({ error: '访问密码尚未设置', needsSetup: true }, 409);
  }

  let body: { password?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: '请求体格式错误' }, 400);
  }

  if (!body.password || !(await verifyPassword(body.password, stored))) {
    return c.json({ error: '密码错误' }, 401);
  }

  const secret = await getSetting(db, 'auth_secret');
  if (!secret) {
    return c.json({ error: '会话密钥缺失，请重新设置密码' }, 500);
  }

  setSessionCookie(c, await signSession(secret, Date.now() + SESSION_TTL_MS));
  return c.json({ success: true });
});

// POST /api/auth/logout - rotate the session secret so the (possibly
// copied) token becomes invalid everywhere, then clear the cookie.
auth.post('/logout', async (c) => {
  const db = c.env.DB;
  await putSetting(db, 'auth_secret', toHex(crypto.getRandomValues(new Uint8Array(32)).buffer as ArrayBuffer));
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
  return c.json({ success: true });
});

// POST /api/auth/change-password - requires the current password
auth.post('/change-password', async (c) => {
  const db = c.env.DB;

  const stored = await getSetting(db, 'auth_password');
  if (!stored) {
    return c.json({ error: '访问密码尚未设置' }, 409);
  }
  if (!(await isAuthenticated(c))) {
    return c.json({ error: '未登录或会话已过期', authRequired: true }, 401);
  }

  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: '请求体格式错误' }, 400);
  }

  if (!body.currentPassword || !(await verifyPassword(body.currentPassword, stored))) {
    return c.json({ error: '当前密码错误', field: 'currentPassword' }, 401);
  }
  if (
    !body.newPassword ||
    typeof body.newPassword !== 'string' ||
    body.newPassword.length < MIN_PASSWORD_LENGTH
  ) {
    return c.json(
      { error: `新密码长度至少 ${MIN_PASSWORD_LENGTH} 个字符`, field: 'newPassword' },
      400
    );
  }

  await putSetting(db, 'auth_password', await hashPassword(body.newPassword));
  // Rotate the session secret: every device must log in again with the
  // new password (the current client is re-authenticated on next request).
  await putSetting(db, 'auth_secret', toHex(crypto.getRandomValues(new Uint8Array(32)).buffer as ArrayBuffer));
  return c.json({ success: true });
});

export default auth;
