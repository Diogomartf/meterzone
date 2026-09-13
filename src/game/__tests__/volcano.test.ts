import { describe, expect, test } from 'bun:test';

import { METER_TOP_OUT, isMeterTopOut } from '@/game/volcano';

describe('isMeterTopOut', () => {
  test('fires once when the fill first crosses the rim', () => {
    expect(isMeterTopOut(METER_TOP_OUT, METER_TOP_OUT - 0.02)).toBe(true);
    expect(isMeterTopOut(1, 0.96)).toBe(true);
  });

  test('does not fire before the rim or on later frames', () => {
    expect(isMeterTopOut(0.96, 0.9)).toBe(false);
    expect(isMeterTopOut(1, 0.99)).toBe(false);
    expect(isMeterTopOut(METER_TOP_OUT, null)).toBe(false);
  });
});
