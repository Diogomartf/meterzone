import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/api/events';

const payload = { event: 'app_store_click', page: '/', placement: 'hero', source: 'google' };
async function send(body: unknown = payload, headers: Record<string, string> = {}, bound = true) {
  const points: unknown[] = [];
  const response = await onRequest({
    request: new Request('https://meterzone.net/api/events', {
      method: 'POST',
      headers: { Origin: 'https://meterzone.net', 'Content-Type': 'application/json', 'User-Agent': 'iPhone', ...headers },
      body: JSON.stringify(body),
    }),
    env: bound ? { DB: { prepare: (sql: string) => ({ bind: (...values: string[]) => ({ run: async () => { points.push({ sql, values }); return { success: true, meta: { changes: 1 } }; } }) }) } } : {},
  });
  return { response, points };
}

test('records coarse click dimensions and discards extra identifying fields', async () => {
  const { response, points } = await send({ ...payload, email: 'private@example.com', referrer: 'https://example.com/private?token=secret' });
  assert.equal(response.status, 204);
  assert.equal((points[0] as any).values[0].length, 64);
  assert.deepEqual((points[2] as any).values, ['app_store_click', '/', 'hero', 'google', 'mobile']);
  assert.match((points[0] as any).sql, /rate_limits/);
});

test('honors privacy headers without recording', async () => {
  for (const header of ['DNT', 'Sec-GPC']) {
    const { response, points } = await send(payload, { [header]: '1' });
    assert.equal(response.status, 204);
    assert.equal(points.length, 0);
  }
});

test('rejects cross-origin posts', async () => {
  const { response, points } = await send(payload, { Origin: 'https://example.com' });
  assert.equal(response.status, 403);
  assert.equal(points.length, 0);
});

test('rejects arbitrary paths, sources, placements and event types', async () => {
  for (const patch of [{ page: '/?email=private@example.com' }, { source: 'private@example.com' }, { placement: 'unknown' }, { event: 'install' }]) {
    const { response, points } = await send({ ...payload, ...patch });
    assert.equal(response.status, 400);
    assert.equal(points.length, 0);
  }
});

test('bounds request bodies even without Content-Length', async () => {
  const { response, points } = await send({ ...payload, oversized: 'x'.repeat(2000) });
  assert.equal(response.status, 413);
  assert.equal(points.length, 0);
});

test('reports missing binding rather than pretending to record', async () => {
  const { response } = await send(payload, {}, false);
  assert.equal(response.status, 503);
});

test('rejects a forged-origin client after the server-side limit', async () => {
  const points: any[] = [];
  const db = { prepare: (sql: string) => ({ bind: (...values: string[]) => ({ run: async () => {
    points.push({ sql, values });
    if (/INSERT INTO rate_limits/.test(sql) && points.filter((point) => /INSERT INTO rate_limits/.test(point.sql)).length > 60) return { success: true, meta: { changes: 0 } };
    return { success: true, meta: { changes: 1 } };
  } }) }) };
  let last = 0;
  for (let i = 0; i < 61; i++) {
    last = (await onRequest({ request: new Request('https://meterzone.net/api/events', { method: 'POST', headers: { Origin: 'https://meterzone.net', 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.8' }, body: JSON.stringify(payload) }), env: { DB: db } })).status;
  }
  assert.equal(last, 429);
  assert.equal(points.filter((point) => /daily_events/.test(point.sql)).length, 60);
});
