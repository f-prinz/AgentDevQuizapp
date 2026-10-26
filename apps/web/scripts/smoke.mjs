import assert from 'node:assert/strict';

const base = process.env.WEB_SMOKE_URL ?? 'http://127.0.0.1:5173';
for (const route of ['/', '/lobbies/smoke/host', '/lobbies/smoke/join', '/lobbies/smoke/player', '/lobbies/smoke/projector']) {
  const response = await fetch(new URL(route, base), { signal: AbortSignal.timeout(5000) });
  assert.equal(response.status, 200, route);
  assert.match(response.headers.get('content-type') ?? '', /text\/html/);
  assert.match(await response.text(), /\/src\/main\.tsx/);
}
console.log('Vite serves the entry document for all five app routes; this is an HTTP startup check, not browser rendering.');
