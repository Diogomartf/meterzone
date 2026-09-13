/** Fill progress at which the tube is visually full and the eruption starts. */
export const METER_TOP_OUT = 0.97;

/** True on the frame the rising fill first crosses the rim. */
export function isMeterTopOut(fill: number, prev: number | null): boolean {
  if (prev == null) return false;
  return prev < METER_TOP_OUT && fill >= METER_TOP_OUT;
}
