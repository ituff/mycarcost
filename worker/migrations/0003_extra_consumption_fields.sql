-- Migration 0003: extra optional fields on consumptions (小熊油耗历史数据导入)
ALTER TABLE consumptions ADD COLUMN remainingRangeKm REAL CHECK(remainingRangeKm >= 0 AND remainingRangeKm <= 9999.9);
ALTER TABLE consumptions ADD COLUMN displayConsumption REAL CHECK(displayConsumption >= 0 AND displayConsumption <= 99.9);
ALTER TABLE consumptions ADD COLUMN consumedKwh REAL CHECK(consumedKwh >= 0 AND consumedKwh <= 9999.99);
ALTER TABLE consumptions ADD COLUMN fullChargeRangeKm REAL CHECK(fullChargeRangeKm >= 0 AND fullChargeRangeKm <= 9999.9);
ALTER TABLE consumptions ADD COLUMN chargingPhase TEXT DEFAULT 'single' CHECK(chargingPhase IN ('single', 'three'));
ALTER TABLE consumptions ADD COLUMN chargingStation TEXT;
ALTER TABLE consumptions ADD COLUMN note TEXT;
