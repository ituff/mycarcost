import { Hono } from 'hono';
import { cors } from 'hono/cors';
import locations from './routes/locations';
import expenseTypes from './routes/expenseTypes';
import vehicles from './routes/vehicles';
import consumptions from './routes/consumptions';
import expenses from './routes/expenses';
import periodicExpenses from './routes/periodicExpenses';
import incomes from './routes/incomes';
import reports from './routes/reports';
import imageRecognition from './routes/imageRecognition';
import settings from './routes/settings';
import sync from './routes/sync';
import auth, { requireAuth } from './auth';

export interface Env {
  DB: D1Database;
  // R2 binding is optional: deploy works without it (image recognition
  // skips the temporary upload). Re-add [[r2_buckets]] once R2 is enabled.
  BUCKET?: R2Bucket;
  ASSETS: Fetcher;
}

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors());

// Access control: /api/auth/* and /api/health stay public, everything
// else under /api requires a session once a password has been set up.
app.use('/api/*', requireAuth);

app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth routes
app.route('/api/auth', auth);

// Historical charging station names for quick-select
app.get('/api/charging-stations', async (c) => {
  const result = await c.env.DB
    .prepare(
      `SELECT DISTINCT chargingStation AS name FROM consumptions
       WHERE chargingStation IS NOT NULL AND chargingStation != ''
       ORDER BY name`
    )
    .all();
  return c.json({ stations: result.results.map((r: any) => r.name) });
});

// Entity management routes
app.route('/api/locations', locations);
app.route('/api/expense-types', expenseTypes);
app.route('/api/vehicles', vehicles);

// Consumption routes: GET/POST at /api/vehicles/:vehicleId/consumptions
// GET single/PUT/DELETE at /api/consumptions/:id
app.route('/api/vehicles', consumptions);
app.route('/api/consumptions', consumptions);

// Expense routes: GET/POST at /api/vehicles/:vehicleId/expenses
// PUT/DELETE at /api/expenses/:id
app.route('/api/vehicles', expenses);
app.route('/api/expenses', expenses);

// Periodic expense routes: GET/POST at /api/vehicles/:vehicleId/periodic-expenses
// PUT/DELETE at /api/periodic-expenses/:id
app.route('/api/vehicles', periodicExpenses);
app.route('/api/periodic-expenses', periodicExpenses);

// Income routes: GET/POST at /api/vehicles/:vehicleId/incomes
// PUT/DELETE at /api/incomes/:id
app.route('/api/vehicles', incomes);
app.route('/api/incomes', incomes);

// Report routes: GET at /api/vehicles/:vehicleId/reports/*
app.route('/api/vehicles', reports);

// Utility routes
app.route('/api/image-recognition', imageRecognition);
app.route('/api/settings', settings);
app.route('/api/sync', sync);

// Non-asset requests reach the Worker when static assets are bound;
// forward them to ASSETS so not_found_handling (SPA fallback) applies.
app.get('*', async (c) => {
  if (c.req.path.startsWith('/api/')) {
    return c.json({ error: 'Not Found' }, 404);
  }
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
