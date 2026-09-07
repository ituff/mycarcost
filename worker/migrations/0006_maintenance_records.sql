-- Migration 0006: maintenance records (保养记录)
CREATE TABLE maintenance_records (
    id TEXT PRIMARY KEY,
    vehicleId TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    recordTime TEXT NOT NULL,
    mileage REAL NOT NULL CHECK(mileage >= 0 AND mileage <= 9999999.9),
    amount REAL NOT NULL CHECK(amount >= 0 AND amount <= 999999999.99),
    items TEXT NOT NULL,
    note TEXT,
    expenseId TEXT REFERENCES expenses(id) ON DELETE SET NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_maintenance_vehicle_time ON maintenance_records(vehicleId, recordTime);
