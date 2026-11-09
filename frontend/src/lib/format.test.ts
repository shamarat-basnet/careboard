import { describe, expect, it } from 'vitest';

import { ageFrom, formatRelativeDays, parseDateOnly } from './format';

describe('date helpers', () => {
  it('parses date-only strings in local time (no UTC off-by-one)', () => {
    const d = parseDateOnly('2024-03-01');
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2024, 2, 1]);
  });

  it('computes age around birthdays', () => {
    const now = new Date(2026, 10, 7);
    expect(ageFrom('1980-11-07', now)).toBe(46);
    expect(ageFrom('1980-11-08', now)).toBe(45);
  });

  it('formats relative visit dates', () => {
    const now = new Date(2026, 10, 7);
    expect(formatRelativeDays(null, now)).toBe('Never');
    expect(formatRelativeDays('2026-11-07', now)).toBe('today');
    expect(formatRelativeDays('2026-11-04', now)).toBe('3 days ago');
  });
});
