import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { buildServer } from '../src/app.ts';

// TECH-15: Produktionsmodus — der Server liefert das Web-Build statisch aus,
// strippt das /api-Praefix des Frontends und faengt SPA-Routen mit index.html ab.
const staticDir = mkdtempSync(join(tmpdir(), 'raccoons-static-'));
writeFileSync(join(staticDir, 'index.html'), '<!doctype html><html><body>app-shell</body></html>');
writeFileSync(join(staticDir, 'asset.txt'), 'static-asset');

afterAll(() => {
  rmSync(staticDir, { recursive: true, force: true });
});

describe('static serving and api prefix (TECH-15)', () => {
  it('strips the /api prefix so frontend calls hit the existing routes', async () => {
    const app = buildServer({ host: '127.0.0.1', port: 0 });
    app.decorate('catalog', []);

    const health = await app.inject({ method: 'GET', url: '/api/health' });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toMatchObject({ version: 1 });

    const lobby = await app.inject({ method: 'POST', url: '/api/lobbies', payload: {} });
    expect(lobby.statusCode).toBe(201);

    const games = await app.inject({ method: 'GET', url: '/api/games' });
    expect(games.statusCode).toBe(200);
    expect(games.json()).toEqual({ games: [] });
    await app.close();
  });

  it('keeps unprefixed routes working alongside the /api prefix', async () => {
    const app = buildServer({ host: '127.0.0.1', port: 0 });
    app.decorate('catalog', []);
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    await app.close();
  });

  it('serves the web build and index.html for the root path when staticDir is set', async () => {
    const app = buildServer({ host: '127.0.0.1', port: 0, staticDir });
    const index = await app.inject({ method: 'GET', url: '/' });
    expect(index.statusCode).toBe(200);
    expect(index.body).toContain('app-shell');

    const asset = await app.inject({ method: 'GET', url: '/asset.txt' });
    expect(asset.statusCode).toBe(200);
    expect(asset.body).toBe('static-asset');
    await app.close();
  });

  it('returns index.html for unknown GET paths (SPA fallback), JSON 404 for api', async () => {
    const app = buildServer({ host: '127.0.0.1', port: 0, staticDir });

    const spa = await app.inject({ method: 'GET', url: '/lobbies/abc/host', headers: { accept: 'text/html' } });
    expect(spa.statusCode).toBe(200);
    expect(spa.body).toContain('app-shell');

    const api = await app.inject({ method: 'GET', url: '/api/unknown' });
    expect(api.statusCode).toBe(404);
    expect(api.json()).toMatchObject({ code: 'LOBBY_NOT_FOUND' });
    await app.close();
  });

  it('keeps the JSON 404 when staticDir is not set', async () => {
    const app = buildServer({ host: '127.0.0.1', port: 0 });
    const spa = await app.inject({ method: 'GET', url: '/lobbies/abc/host', headers: { accept: 'text/html' } });
    expect(spa.statusCode).toBe(404);
    await app.close();
  });
});
