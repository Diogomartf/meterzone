/**
 * Thousands-grouped score, e.g. 14869 -> "14,869". Hermes-safe (no Intl), and
 * a worklet so count-ups can format on the UI thread.
 */
export function formatScore(n: number): string {
  'worklet';
  const s = Math.max(0, Math.round(n)).toString();
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ',';
    out += s[i];
  }
  return out;
}
