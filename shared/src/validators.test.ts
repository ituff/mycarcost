import { describe, it, expect } from 'vitest';
import {
  validateVehicleName,
  validateLocationName,
  validateExpenseTypeName,
  validateMileage,
  validateQuantity,
  validateUnitPrice,
  isFuelTypeCompatible,
  validateConsumption,
} from './validators';

describe('entity name validation', () => {
  it('rejects empty vehicle name', () => {
    expect(validateVehicleName('', [])).not.toBeNull();
    expect(validateVehicleName('  ', [])).not.toBeNull();
  });

  it('rejects vehicle name over 30 chars', () => {
    expect(validateVehicleName('a'.repeat(31), [])).not.toBeNull();
  });

  it('accepts valid unique name', () => {
    expect(validateVehicleName('高尔夫7', [])).toBeNull();
  });

  it('rejects duplicate name', () => {
    expect(validateVehicleName('高尔夫7', ['高尔夫7'])).toBe('名称已存在');
  });

  it('location name: rejects >50 chars and duplicates', () => {
    expect(validateLocationName('a'.repeat(51), [])).not.toBeNull();
    expect(validateLocationName('站', ['站'])).toBe('名称已存在');
    expect(validateLocationName('中石化加油站', [])).toBeNull();
  });

  it('expense type name: rejects >20 chars and duplicates', () => {
    expect(validateExpenseTypeName('a'.repeat(21), [])).not.toBeNull();
    expect(validateExpenseTypeName('停车费', ['停车费'])).toBe('名称已存在');
  });
});

describe('numeric range validation', () => {
  it('mileage bounds', () => {
    expect(validateMileage(0)).toBe(true);
    expect(validateMileage(9999999.9)).toBe(true);
    expect(validateMileage(-0.1)).toBe(false);
    expect(validateMileage(10000000)).toBe(false);
  });

  it('quantity bounds', () => {
    expect(validateQuantity(0.01)).toBe(true);
    expect(validateQuantity(99999.99)).toBe(true);
    expect(validateQuantity(0)).toBe(false);
  });

  it('unit price bounds', () => {
    expect(validateUnitPrice(0.001)).toBe(true);
    expect(validateUnitPrice(99.999)).toBe(true);
    expect(validateUnitPrice(0)).toBe(false);
    expect(validateUnitPrice(100)).toBe(false);
  });
});

describe('fuel type compatibility', () => {
  it('fuel vehicles accept gasoline/diesel only', () => {
    expect(isFuelTypeCompatible('gasoline', 'fuel')).toBe(true);
    expect(isFuelTypeCompatible('diesel', 'fuel')).toBe(true);
    expect(isFuelTypeCompatible('electric', 'fuel')).toBe(false);
  });

  it('electric vehicles accept electric only', () => {
    expect(isFuelTypeCompatible('electric', 'electric')).toBe(true);
    expect(isFuelTypeCompatible('gasoline', 'electric')).toBe(false);
  });

  it('hybrid vehicles accept all', () => {
    expect(isFuelTypeCompatible('gasoline', 'hybrid')).toBe(true);
    expect(isFuelTypeCompatible('diesel', 'hybrid')).toBe(true);
    expect(isFuelTypeCompatible('electric', 'hybrid')).toBe(true);
  });
});

describe('consumption validation', () => {
  const base = { mileage: 10000, fuelType: 'gasoline' as const, quantity: 40, unitPrice: 7.5 };

  it('accepts a valid fuel record', () => {
    expect(validateConsumption(base, 'fuel')).toEqual({});
  });

  it('requires quantity', () => {
    const errors = validateConsumption({ ...base, quantity: undefined }, 'fuel');
    expect(errors['quantity']).toBeTruthy();
  });

  it('requires unit price or total price', () => {
    const errors = validateConsumption({ ...base, unitPrice: undefined }, 'fuel');
    expect(errors['unitPrice']).toBeTruthy();
  });

  it('rejects incompatible fuel type for electric vehicle', () => {
    const errors = validateConsumption(
      { ...base, fuelType: 'gasoline' },
      'electric'
    );
    expect(errors['fuelType']).toBe('电动车只能选择电');
  });

  it('requires battery before/after with after > before for electric', () => {
    const errors = validateConsumption(
      {
        mileage: 5000,
        fuelType: 'electric',
        quantity: 30,
        unitPrice: 0.5,
        batteryBefore: 80,
        batteryAfter: 50,
        electricityDetails: [{ quantity: 30, unitPrice: 0.5 }],
      },
      'electric'
    );
    expect(errors['batteryAfter']).toBe('充电后电量百分比必须大于充电前电量百分比');
  });

  it('requires at least one electricity detail for electric', () => {
    const errors = validateConsumption(
      {
        mileage: 5000,
        fuelType: 'electric',
        quantity: 30,
        unitPrice: 0.5,
        batteryBefore: 20,
        batteryAfter: 80,
        electricityDetails: [],
      },
      'electric'
    );
    expect(errors['electricityDetails']).toBeTruthy();
  });
});
