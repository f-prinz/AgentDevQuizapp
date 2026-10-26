import type { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import type { GameSeed } from '@raccoons/contracts';
import { buildServer } from './app.ts';
import type { ServerConfig } from './config.ts';
import { initializeCatalog, loadSeedGames } from './catalog.ts';

export interface CatalogServerOptions {
  databaseUrl: string;
  seedDirectory?: string;
}

export type CatalogServerInstance = FastifyInstance & { readonly catalog: GameSeed[] };

function validateDatabaseUrl(databaseUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error('A valid local DATABASE_URL is required.');
  }

  const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
  if ((parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:')
    || !localHosts.has(parsed.hostname.toLowerCase())
    || parsed.search !== '') {
    throw new Error('A valid local DATABASE_URL is required.');
  }
}

export async function startCatalogServer(
  config: ServerConfig,
  options: CatalogServerOptions,
): Promise<CatalogServerInstance> {
  validateDatabaseUrl(options.databaseUrl);

  let pool: Pool | undefined;
  let app: FastifyInstance | undefined;
  let poolClosed = false;
  const closePool = async (): Promise<void> => {
    if (pool && !poolClosed) {
      await pool.end();
      poolClosed = true;
    }
  };

  try {
    const seeds = await loadSeedGames(options.seedDirectory);
    pool = new Pool({ connectionString: options.databaseUrl });
    const catalog = await initializeCatalog(pool, seeds);
    await closePool();
    app = buildServer(config);
    app.decorate('catalog', catalog);
    await app.listen({ host: config.host, port: config.port });
    return app as CatalogServerInstance;
  } catch {
    if (app) {
      await app.close().catch(() => undefined);
    }
    await closePool().catch(() => undefined);
    throw new Error('Catalog server failed to start.');
  }
}
