-- Migration 0002: optional charge display fields on consumptions
-- 车辆显示充电电量 / 充电桩显示充电电量 (kWh)
ALTER TABLE consumptions ADD COLUMN vehicleDisplayedKwh REAL CHECK(vehicleDisplayedKwh >= 0 AND vehicleDisplayedKwh <= 99999.99);
ALTER TABLE consumptions ADD COLUMN chargerDisplayedKwh REAL CHECK(chargerDisplayedKwh >= 0 AND chargerDisplayedKwh <= 99999.99);
