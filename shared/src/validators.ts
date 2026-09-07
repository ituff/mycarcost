import {
  VEHICLE_NAME_MIN_LENGTH,
  VEHICLE_NAME_MAX_LENGTH,
  LOCATION_NAME_MIN_LENGTH,
  LOCATION_NAME_MAX_LENGTH,
  EXPENSE_TYPE_NAME_MIN_LENGTH,
  EXPENSE_TYPE_NAME_MAX_LENGTH,
  MILEAGE_MIN,
  MILEAGE_MAX,
  QUANTITY_MIN,
  QUANTITY_MAX,
  UNIT_PRICE_MIN,
  UNIT_PRICE_MAX,
  BATTERY_PERCENT_MIN,
  BATTERY_PERCENT_MAX,
  ELECTRICITY_DETAILS_MIN_GROUPS,
  ELECTRICITY_DETAILS_MAX_GROUPS,
} from './validation';
import type { VehicleType, FuelType } from './enums';

// ============================================================
// Entity name validation
// ============================================================

export function validateVehicleName(name: string, existingNames: string[]): string | null {
  const trimmed = name?.trim() || '';
  if (trimmed.length < VEHICLE_NAME_MIN_LENGTH) {
    return '请输入车辆名称';
  }
  if (trimmed.length > VEHICLE_NAME_MAX_LENGTH) {
    return `车辆名称不能超过${VEHICLE_NAME_MAX_LENGTH}个字符`;
  }
  if (existingNames.includes(trimmed)) {
    return '名称已存在';
  }
  return null;
}

export function validateLocationName(name: string, existingNames: string[]): string | null {
  const trimmed = name?.trim() || '';
  if (trimmed.length < LOCATION_NAME_MIN_LENGTH) {
    return '请输入地点名称';
  }
  if (trimmed.length > LOCATION_NAME_MAX_LENGTH) {
    return `地点名称不能超过${LOCATION_NAME_MAX_LENGTH}个字符`;
  }
  if (existingNames.includes(trimmed)) {
    return '名称已存在';
  }
  return null;
}

export function validateExpenseTypeName(name: string, existingNames: string[]): string | null {
  const trimmed = name?.trim() || '';
  if (trimmed.length < EXPENSE_TYPE_NAME_MIN_LENGTH) {
    return '请输入类型名称';
  }
  if (trimmed.length > EXPENSE_TYPE_NAME_MAX_LENGTH) {
    return `类型名称不能超过${EXPENSE_TYPE_NAME_MAX_LENGTH}个字符`;
  }
  if (existingNames.includes(trimmed)) {
    return '名称已存在';
  }
  return null;
}

// ============================================================
// Numeric range validation
// ============================================================

export function validateMileage(mileage: number): boolean {
  return (
    typeof mileage === 'number' && !isNaN(mileage) && mileage >= MILEAGE_MIN && mileage <= MILEAGE_MAX
  );
}

export function validateQuantity(quantity: number): boolean {
  return (
    typeof quantity === 'number' && !isNaN(quantity) && quantity >= QUANTITY_MIN && quantity <= QUANTITY_MAX
  );
}

export function validateUnitPrice(unitPrice: number): boolean {
  return (
    typeof unitPrice === 'number' && !isNaN(unitPrice) && unitPrice >= UNIT_PRICE_MIN && unitPrice <= UNIT_PRICE_MAX
  );
}

// ============================================================
// Consumption record validation
// ============================================================

export function isFuelTypeCompatible(
  fuelType: FuelType,
  vehicleType: VehicleType
): boolean {
  switch (vehicleType) {
    case 'fuel':
      return fuelType === 'gasoline' || fuelType === 'diesel';
    case 'electric':
      return fuelType === 'electric';
    case 'hybrid':
      return true;
    default:
      return false;
  }
}

function getFuelTypeIncompatibilityMessage(
  fuelType: FuelType,
  vehicleType: VehicleType
): string {
  switch (vehicleType) {
    case 'fuel':
      return '燃油车只能选择汽油或柴油';
    case 'electric':
      return '电动车只能选择电';
    default:
      return `燃料类型"${fuelType}"与车辆类型"${vehicleType}"不兼容`;
  }
}

export interface ConsumptionInput {
  mileage?: number;
  fuelType?: FuelType;
  quantity?: number;
  unitPrice?: number;
  totalPrice?: number;
  batteryBefore?: number;
  batteryAfter?: number;
  electricityDetails?: { quantity: number; unitPrice: number }[];
}

export function validateConsumption(
  input: ConsumptionInput,
  vehicleType: VehicleType
): Record<string, string> {
  const errors: Record<string, string> = {};

  // mileage
  if (input.mileage === undefined || input.mileage === null) {
    errors['mileage'] = '请输入当前里程';
  } else if (!validateMileage(input.mileage)) {
    errors['mileage'] = `里程必须在${MILEAGE_MIN}至${MILEAGE_MAX}之间`;
  }

  // fuelType compatibility
  const fuelTypeCompatible = isFuelTypeCompatible(input.fuelType!, vehicleType);
  if (!fuelTypeCompatible) {
    errors['fuelType'] = getFuelTypeIncompatibilityMessage(input.fuelType!, vehicleType);
  }

  // quantity
  if (input.quantity === undefined || input.quantity === null) {
    errors['quantity'] = '请输入加注量';
  } else if (!validateQuantity(input.quantity)) {
    errors['quantity'] = `加注量必须在${QUANTITY_MIN}至${QUANTITY_MAX}之间`;
  }

  // unitPrice or totalPrice
  if (input.unitPrice !== undefined && input.unitPrice !== null) {
    if (!validateUnitPrice(input.unitPrice)) {
      errors['unitPrice'] = `单价必须在${UNIT_PRICE_MIN}至${UNIT_PRICE_MAX}之间`;
    }
  } else if (input.totalPrice === undefined || input.totalPrice === null) {
    errors['unitPrice'] = '请输入单价或总价';
  }

  // Electric-specific validations
  if (input.fuelType === 'electric' && !errors['fuelType']) {
    if (input.batteryBefore === undefined || input.batteryBefore === null) {
      errors['batteryBefore'] = '请输入充电前电量百分比';
    } else if (
      !Number.isInteger(input.batteryBefore) ||
      input.batteryBefore < BATTERY_PERCENT_MIN ||
      input.batteryBefore > BATTERY_PERCENT_MAX
    ) {
      errors['batteryBefore'] = '充电前电量百分比必须为0-100的整数';
    }

    if (input.batteryAfter === undefined || input.batteryAfter === null) {
      errors['batteryAfter'] = '请输入充电后电量百分比';
    } else if (
      !Number.isInteger(input.batteryAfter) ||
      input.batteryAfter < BATTERY_PERCENT_MIN ||
      input.batteryAfter > BATTERY_PERCENT_MAX
    ) {
      errors['batteryAfter'] = '充电后电量百分比必须为0-100的整数';
    }

    if (
      !errors['batteryBefore'] &&
      !errors['batteryAfter'] &&
      input.batteryAfter! <= input.batteryBefore!
    ) {
      errors['batteryAfter'] = '充电后电量百分比必须大于充电前电量百分比';
    }

    // electricityDetails 1-10 groups
    if (!input.electricityDetails || input.electricityDetails.length === 0) {
      errors['electricityDetails'] = `请至少添加${ELECTRICITY_DETAILS_MIN_GROUPS}组电量明细`;
    } else if (input.electricityDetails.length > ELECTRICITY_DETAILS_MAX_GROUPS) {
      errors['electricityDetails'] = `电量明细最多${ELECTRICITY_DETAILS_MAX_GROUPS}组`;
    }
  }

  return errors;
}
