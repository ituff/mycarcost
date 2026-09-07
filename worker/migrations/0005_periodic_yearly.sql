-- Migration 0005: periodic expenses gain yearly period and generation tracking
-- SQLite cannot alter a CHECK constraint, so recreate the table.
CREATE TABLE periodic_expenses_new (
    id TEXT PRIMARY KEY,
    vehicleId TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    expenseTypeId TEXT NOT NULL REFERENCES expense_types(id) ON DELETE CASCADE,
    amount REAL NOT NULL CHECK(amount >= 0.01 AND amount <= 999999999.99),
    period TEXT NOT NULL CHECK(period IN ('daily', 'monthly', 'yearly')),
    startDate TEXT NOT NULL,
    endDate TEXT NOT NULL,
    lastGeneratedDate TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO periodic_expenses_new (id, vehicleId, expenseTypeId, amount, period, startDate, endDate, createdAt, updatedAt)
SELECT id, vehicleId, expenseTypeId, amount, period, startDate, endDate, createdAt, updatedAt FROM periodic_expenses;

DROP TABLE periodic_expenses;
ALTER TABLE periodic_expenses_new RENAME TO periodic_expenses;
