/** Thousands-grouped score, e.g. 14869 -> "14,869". Hermes-safe (no Intl). */
export function formatScore(n: number): string {
  const s = Math.max(0, Math.round(n)).toString();
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
