-- Migration 0004: income records (收入统计)
CREATE TABLE incomes (
    id TEXT PRIMARY KEY,
    vehicleId TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    amount REAL NOT NULL CHECK(amount >= 0.01 AND amount <= 999999999.99),
    typeName TEXT,
    note TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_incomes_vehicle_date ON incomes(vehicleId, date);
