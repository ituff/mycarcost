-- Initial schema
-- Tables: vehicles, consumptions, consumption_electricity_details, locations,
--         expense_types, expenses, periodic_expenses, settings, conflict_archive

-- 地点表 (created before consumptions due to foreign key reference)
CREATE TABLE locations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    address TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 车辆表
CREATE TABLE vehicles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('fuel', 'electric', 'hybrid')),
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 能耗记录表
CREATE TABLE consumptions (
    id TEXT PRIMARY KEY,
    vehicleId TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    recordTime TEXT NOT NULL,
    mileage REAL NOT NULL CHECK(mileage >= 0 AND mileage <= 9999999.9),
    fuelType TEXT NOT NULL CHECK(fuelType IN ('gasoline', 'diesel', 'electric')),
    quantity REAL NOT NULL CHECK(quantity >= 0.01 AND quantity <= 99999.99),
    unitPrice REAL NOT NULL CHECK(unitPrice >= 0.001 AND unitPrice <= 99.999),
    totalPrice REAL,
    chargingType TEXT CHECK(chargingType IN ('dc', 'ac')),
    chargingCurrent REAL CHECK(chargingCurrent >= 1 AND chargingCurrent <= 256),
    batteryBefore INTEGER CHECK(batteryBefore >= 0 AND batteryBefore <= 100),
    batteryAfter INTEGER CHECK(batteryAfter >= 0 AND batteryAfter <= 100),
    estimatedRange REAL CHECK(estimatedRange >= 0 AND estimatedRange <= 9999.9),
    locationId TEXT REFERENCES locations(id) ON DELETE SET NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 峰谷电价明细表
CREATE TABLE consumption_electricity_details (
    id TEXT PRIMARY KEY,
    consumptionId TEXT NOT NULL REFERENCES consumptions(id) ON DELETE CASCADE,
    quantity REAL NOT NULL,
    unitPrice REAL NOT NULL,
    sortOrder INTEGER NOT NULL DEFAULT 0
);

-- 费用类型表
CREATE TABLE expense_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#3B82F6',
    isAmortized INTEGER NOT NULL DEFAULT 0,
    amortizedMonths INTEGER CHECK(amortizedMonths >= 1 AND amortizedMonths <= 60) DEFAULT 12,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 费用记录表
CREATE TABLE expenses (
    id TEXT PRIMARY KEY,
    vehicleId TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    expenseTypeId TEXT NOT NULL REFERENCES expense_types(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    amount REAL NOT NULL CHECK(amount >= 0.01 AND amount <= 999999999.99),
    note TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 周期费用表
CREATE TABLE periodic_expenses (
    id TEXT PRIMARY KEY,
    vehicleId TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    expenseTypeId TEXT NOT NULL REFERENCES expense_types(id) ON DELETE CASCADE,
    amount REAL NOT NULL CHECK(amount >= 0.01 AND amount <= 999999999.99),
    period TEXT NOT NULL CHECK(period IN ('daily', 'monthly')),
    startDate TEXT NOT NULL,
    endDate TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 设置表 (key-value)
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

-- 冲突存档表 (LWW sync overwritten records)
CREATE TABLE conflict_archive (
    id TEXT PRIMARY KEY,
    tableName TEXT NOT NULL,
    recordId TEXT NOT NULL,
    data TEXT NOT NULL,
    archivedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_consumptions_vehicle_time ON consumptions(vehicleId, recordTime);
CREATE INDEX idx_expenses_vehicle_date ON expenses(vehicleId, date);
CREATE INDEX idx_expense_types ON expenses(expenseTypeId);
