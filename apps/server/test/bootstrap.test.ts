import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { startCatalogServer, validateDatabaseUrl } from '../src/bootstrap.ts';
import type { ServerConfig } from '../src/config.ts';
import { startEphemeralPostgres, type EphemeralPostgres } from './helpers/postgres.ts';

const serverConfig: ServerConfig = { host: '127.0.0.1', port: 0 };
let postgres: EphemeralPostgres;
let app: FastifyInstance | undefined;

describe('catalog server bootstrap', () => {
  beforeAll(async () => {
    postgres = await startEphemeralPostgres();
  }, 120_000);

  afterAll(async () => {
    if (app) await app.close();
    if (postgres) await postgres.stop();
  }, 30_000);

  it('finishes database initialization before listening with an empty catalog', async () => {
    const catalogApp = await startCatalogServer(serverConfig, { databaseUrl: postgres.connectionString });
    app = catalogApp;

    // CHG-9: Kein initiales Seeding — der Katalog startet leer und wird
    // ausschliesslich ueber die Admin-API befuellt.
    expect(catalogApp.catalog).toEqual([]);

    const address = catalogApp.server.address();
    expect(address).not.toBeNull();
    if (!address || typeof address === 'string') throw new Error('Expected a TCP address.');

    const response = await fetch(`http://127.0.0.1:${address.port}/health`);
    expect(response.status).toBe(200);
    await catalogApp.close();
    app = undefined;
  });

  it('rejects remote database URLs without starting a server', async () => {
    await expect(startCatalogServer(serverConfig, {
      databaseUrl: 'postgresql://user:password@example.com/database',
    })).rejects.toThrow('local DATABASE_URL');
  });

  it('accepts remote database URLs when allowRemoteDatabase is set', () => {
    // TECH-15: Railway-Deployment — die Private-Network-URL ist nicht lokal.
    expect(() => validateDatabaseUrl('postgresql://user:password@example.com/database', true)).not.toThrow();
    expect(() => validateDatabaseUrl('postgresql://postgres:x@postgres.railway.internal:5432/railway', true)).not.toThrow();
    expect(() => validateDatabaseUrl('postgresql://user:password@example.com/database', false)).toThrow('local DATABASE_URL');
    expect(() => validateDatabaseUrl('not-a-url', true)).toThrow('DATABASE_URL');
  });
});
