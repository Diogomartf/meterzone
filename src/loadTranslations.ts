/**
 * Metro cannot resolve dynamic imports, so every locale bundle is required
 * statically. `npx gt translate` (or `gt generate`) writes these files.
 */
const translations: Record<string, unknown> = {
  pt: require('./_gt/pt.json'),
  es: require('./_gt/es.json'),
};

export async function loadTranslations(locale: string) {
  return translations[locale] ?? {};
}
