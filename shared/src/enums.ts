/**
 * Vehicle type enumeration
 */
export type VehicleType = 'fuel' | 'electric' | 'hybrid';

/**
 * Fuel type enumeration
 */
export type FuelType = 'gasoline' | 'diesel' | 'electric';

/**
 * Charging type enumeration (for electric vehicles)
 */
export type ChargingType = 'dc' | 'ac';

/**
 * Period enumeration for periodic expenses
 */
export type Period = 'daily' | 'monthly' | 'yearly';

/**
 * Sync status for local records
 */
export type SyncStatusType = 'synced' | 'pending' | 'conflict';

/**
 * Sync operation type
 */
export type SyncOperation = 'create' | 'update' | 'delete';

/**
 * Sync engine state
 */
export type SyncState = 'idle' | 'syncing' | 'error';
