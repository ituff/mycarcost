import Dexie, { type Table } from 'dexie';
import type { SyncQueueItem } from '@mycarcost/shared';

/**
 * 本地优先存储层（IndexedDB via Dexie）。
 * 所有实体表带同步元数据：_syncStatus / _localUpdatedAt / _serverUpdatedAt。
 * 页面当前直连 API（在线模式），本库为离线模式与同步引擎的持久化基础。
 */

export interface LocalVehicle {
  id: string;
  name: string;
  type: string;
  createdAt: string;
  updatedAt: string;
  _syncStatus?: 'synced' | 'pending' | 'conflict';
  _localUpdatedAt?: string;
  _serverUpdatedAt?: string;
}

export interface LocalConsumption {
  id: string;
  vehicleId: string;
  recordTime: string;
  mileage: number;
  fuelType: string;
  quantity: number;
  unitPrice: number;
  totalPrice?: number;
  [key: string]: any;
}

export interface LocalLocation {
  id: string;
  name: string;
  address?: string;
}

export interface LocalExpenseType {
  id: string;
  name: string;
  color: string;
  isAmortized?: boolean;
  amortizedMonths?: number;
}

export interface LocalExpense {
  id: string;
  vehicleId: string;
  expenseTypeId: string;
  date: string;
  amount: number;
  note?: string;
}

export interface LocalPeriodicExpense {
  id: string;
  vehicleId: string;
  expenseTypeId: string;
  amount: number;
  period: string;
  startDate: string;
  endDate: string;
}

export interface LocalIncome {
  id: string;
  vehicleId: string;
  date: string;
  amount: number;
  typeName?: string;
  note?: string;
}

export interface ConflictArchiveItem {
  id?: number;
  tableName: string;
  recordId: string;
  data: string;
  archivedAt: string;
}

class MyCarCostDB extends Dexie {
  vehicles!: Table<LocalVehicle, string>;
  consumptions!: Table<LocalConsumption, string>;
  locations!: Table<LocalLocation, string>;
  expenseTypes!: Table<LocalExpenseType, string>;
  expenses!: Table<LocalExpense, string>;
  periodicExpenses!: Table<LocalPeriodicExpense, string>;
  incomes!: Table<LocalIncome, string>;
  syncQueue!: Table<SyncQueueItem, number>;
  conflictArchive!: Table<ConflictArchiveItem, number>;

  constructor() {
    super('MyCarCostDB');
    this.version(1).stores({
      vehicles: 'id, name, _syncStatus',
      consumptions: 'id, vehicleId, recordTime, _syncStatus',
      locations: 'id, name',
      expenseTypes: 'id, name',
      expenses: 'id, vehicleId, date, _syncStatus',
      periodicExpenses: 'id, vehicleId',
      incomes: 'id, vehicleId, date',
      syncQueue: '++id, tableName, recordId',
      conflictArchive: '++id, tableName, recordId, archivedAt',
    });
  }
}

export const localDb = new MyCarCostDB();
