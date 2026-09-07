import { describe, it, expect } from 'vitest';
import {
  calculateUnitPrice,
  calculatePer100km,
  calculateCostPerKm,
  amortizeExpense,
  generatePeriodicEntries,
} from './calculations';

describe('calculateUnitPrice', () => {
  it('divides totalPrice by quantity with 3 decimals', () => {
    expect(calculateUnitPrice(300.75, 40.5)).toBe(7.426);
  });

  it('rounds to 3 decimals', () => {
    expect(calculateUnitPrice(100, 3)).toBe(33.333);
  });

  it('returns 0 for zero quantity', () => {
    expect(calculateUnitPrice(100, 0)).toBe(0);
  });
});

describe('calculatePer100km', () => {
  it('computes quantity per 100km with 1 decimal', () => {
    expect(calculatePer100km(35, 500)).toBe(7);
  });

  it('rounds to 1 decimal', () => {
    expect(calculatePer100km(30, 333)).toBe(9);
  });

  it('returns 0 for zero distance', () => {
    expect(calculatePer100km(30, 0)).toBe(0);
  });
});

describe('calculateCostPerKm', () => {
  it('divides cost by distance with 2 decimals', () => {
    expect(calculateCostPerKm(1000, 400)).toBe(2.5);
  });

  it('returns null for zero distance', () => {
    expect(calculateCostPerKm(100, 0)).toBeNull();
  });
});

describe('amortizeExpense', () => {
  it('distributes evenly and preserves total', () => {
    const entries = amortizeExpense(1200.5, 12, '2026-01-15');
    expect(entries).toHaveLength(12);
    const total = entries.reduce((s, e) => s + e.amount, 0);
    expect(Math.round(total * 100) / 100).toBe(1200.5);
    expect(entries[0].month).toBe('2026-01');
    expect(entries[11].month).toBe('2026-12');
  });

  it('returns empty for zero months', () => {
    expect(amortizeExpense(100, 0, '2026-01-01')).toEqual([]);
  });
});

describe('generatePeriodicEntries', () => {
  it('generates daily entries inclusive of both ends', () => {
    const entries = generatePeriodicEntries(5, 'daily', '2026-01-01', '2026-01-04');
    expect(entries).toHaveLength(4);
    expect(entries[0].date).toBe('2026-01-01');
    expect(entries[3].date).toBe('2026-01-04');
  });

  it('generates monthly entries aligned to start day', () => {
    const entries = generatePeriodicEntries(200, 'monthly', '2026-01-31', '2026-04-30');
    expect(entries.map((e) => e.date)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  });

  it('returns empty when end is before start', () => {
    expect(generatePeriodicEntries(5, 'daily', '2026-02-01', '2026-01-01')).toEqual([]);
  });
});
