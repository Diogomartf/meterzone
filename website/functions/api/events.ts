interface AnalyticsDatabase {
  prepare(sql: string): { bind(...values: string[]): { run(): Promise<{ success: boolean }> } };
}

interface Context {
  request: Request;
  env: { DB?: AnalyticsDatabase };
}

const pages = new Set(['/', '/how-to-play/', '/support/', '/privacy/']);
const sources = new Set(['direct', 'internal', 'google', 'bing', 'instagram', 'facebook', 'tiktok', 'reddit', 'youtube', 'newsletter', 'other', 'other-campaign']);
const placements: Record<string, string[]> = {
  '/': ['hero', 'after-faq'],
  '/how-to-play/': ['gameplay-guide'],
};

export async function onRequest({ request, env }: Context): Promise<Response> {
  const respond = (status: number) => new Response(null, { status, headers: { 'Cache-Control': 'no-store' } });
  if (request.method !== 'POST') return respond(405);
  // Previews never write production analytics. Reject cross-origin browser posts.
  if (new URL(request.url).hostname !== 'meterzone.net' || request.headers.get('Origin') !== 'https://meterzone.net') return respond(403);
  if (request.headers.get('DNT') === '1' || request.headers.get('Sec-GPC') === '1') return respond(204);
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) return respond(415);
  if (Number(request.headers.get('Content-Length')) > 1024) return respond(413);
  // Bound streamed requests too, rather than trusting Content-Length.
  const reader = request.body?.getReader();
  if (!reader) return respond(400);
  let text = '';
  let size = 0;
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 1024) { await reader.cancel(); return respond(413); }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  let data;
  try { data = JSON.parse(text); } catch { return respond(400); }
  if (!data || typeof data !== 'object' || !pages.has(data.page) || !sources.has(data.source)) return respond(400);
  if (data.event !== 'page_view' && data.event !== 'app_store_click') return respond(400);
  if (data.event === 'app_store_click' && !placements[data.page]?.includes(data.placement)) return respond(400);
  if (!env.DB) return respond(503);

  const ua = request.headers.get('User-Agent') || '';
  const device = /iPad|Tablet|Android(?!.*Mobile)/i.test(ua) ? 'tablet' : /iPhone|Android|Mobile/i.test(ua) ? 'mobile' : 'desktop';
  try {
    const result = await env.DB.prepare(`
      INSERT INTO daily_events (day, event, page, placement, source, device, count)
      VALUES (date('now'), ?1, ?2, ?3, ?4, ?5, 1)
      ON CONFLICT (day, event, page, placement, source, device)
      DO UPDATE SET count = count + 1
    `).bind(data.event, data.page, data.event === 'app_store_click' ? data.placement : '', data.source, device).run();
    if (!result.success) return respond(503);
  } catch { return respond(503); }
  return respond(204);
}
