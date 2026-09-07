import type { VehicleType, FuelType, ChargingType, Period, SyncState } from './enums';

export interface Vehicle {
  id: string;
  name: string;
  type: VehicleType;
  createdAt: string;
  updatedAt: string;
  /** 车辆列表统计：总里程（能耗记录最大里程） */
  totalMileage?: number;
  /** 车辆列表统计：总费用（能耗 + 费用） */
  totalExpense?: number;
}

export interface Consumption {
  id: string;
  vehicleId: string;
  recordTime: string;
  mileage: number;
  fuelType: FuelType;
  quantity: number;
  unitPrice: number;
  totalPrice?: number;
  chargingType?: ChargingType;
  chargingCurrent?: number;
  /** 电流相数：单相/三相，默认单相 */
  chargingPhase?: 'single' | 'three';
  batteryBefore?: number;
  batteryAfter?: number;
  estimatedRange?: number;
  /** 充电后表显剩余续航 (km) */
  remainingRangeKm?: number;
  /** 车机显示能耗 (kWh/100km) */
  displayConsumption?: number;
  /** 车机显示本次消耗电量 (kWh) */
  consumedKwh?: number;
  /** 充满电表显续航 (km) */
  fullChargeRangeKm?: number;
  /** 车辆仪表显示的充电电量 (kWh)，可选 */
  vehicleDisplayedKwh?: number;
  /** 充电桩显示的充电电量 (kWh)，可选 */
  chargerDisplayedKwh?: number;
  /** 充电站名称（直流充电） */
  chargingStation?: string;
  /** 备注 */
  note?: string;
  locationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ElectricityDetail {
  id: string;
  consumptionId: string;
  quantity: number;
  unitPrice: number;
  sortOrder: number;
}

export interface Income {
  id: string;
  vehicleId: string;
  date: string;
  amount: number;
  typeName?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Location {
  id: string;
  name: string;
  address?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseType {
  id: string;
  name: string;
  color: string;
  isAmortized: boolean;
  amortizedMonths?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Expense {
  id: string;
  vehicleId: string;
  expenseTypeId: string;
  date: string;
  amount: number;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PeriodicExpense {
  id: string;
  vehicleId: string;
  expenseTypeId: string;
  amount: number;
  period: Period;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface Setting {
  key: string;
  value: string;
}

export interface SyncQueueItem {
  id?: number;
  tableName: string;
  operation: 'create' | 'update' | 'delete';
  recordId: string;
  record?: any;
  createdAt: string;
  retries: number;
}

export interface SyncStatus {
  isOnline: boolean;
  pendingCount: number;
  lastSyncTime: string | null;
  syncState: SyncState;
  retryCount: number;
}
