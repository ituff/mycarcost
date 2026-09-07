/**
 * Field length and numeric range constants shared across frontend and worker.
 */

// Vehicle
export const VEHICLE_NAME_MIN_LENGTH = 1;
export const VEHICLE_NAME_MAX_LENGTH = 30;
export const MAX_VEHICLES = 20;

// Consumption
export const MILEAGE_MIN = 0;
export const MILEAGE_MAX = 9999999.9;
export const QUANTITY_MIN = 0.01;
export const QUANTITY_MAX = 99999.99;
export const UNIT_PRICE_MIN = 0.001;
export const UNIT_PRICE_MAX = 99.999;
export const BATTERY_PERCENT_MIN = 0;
export const BATTERY_PERCENT_MAX = 100;
export const CHARGING_CURRENT_MIN = 1;
export const CHARGING_CURRENT_MAX = 256;
export const ESTIMATED_RANGE_MIN = 0;
export const ESTIMATED_RANGE_MAX = 9999.9;
export const ELECTRICITY_DETAILS_MIN_GROUPS = 1;
export const ELECTRICITY_DETAILS_MAX_GROUPS = 10;

// Location
export const LOCATION_NAME_MIN_LENGTH = 1;
export const LOCATION_NAME_MAX_LENGTH = 50;
export const LOCATION_ADDRESS_MAX_LENGTH = 200;

// Expense type
export const EXPENSE_TYPE_NAME_MIN_LENGTH = 1;
export const EXPENSE_TYPE_NAME_MAX_LENGTH = 20;
export const AMORTIZED_MONTHS_MIN = 1;
export const AMORTIZED_MONTHS_MAX = 60;
export const DEFAULT_AMORTIZED_MONTHS = 12;

// Expense / income
export const AMOUNT_MIN = 0.01;
export const AMOUNT_MAX = 999999999.99;
export const EXPENSE_NOTE_MAX_LENGTH = 200;
export const MAX_NOTE_SUGGESTIONS = 10;

// Image recognition
export const IMAGE_MAX_SIZE_BYTES = 10 * 1024 * 1024;
export const IMAGE_ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'];
export const IMAGE_RECOGNITION_TIMEOUT_MS = 30_000;

// Sync
export const SYNC_TRIGGER_DELAY_MS = 30_000;
export const SYNC_RETRY_DELAY_MS = 60_000;
export const SYNC_MAX_RETRIES = 3;
