import type { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import type { GameSeed } from '@raccoons/contracts';
import { buildServer } from './app.ts';
import type { ServerConfig } from './config.ts';
import { initializeCatalog, loadSeedGames } from './catalog.ts';
import { createCatalogStore } from './catalog-admin.ts';

export interface CatalogServerOptions {
  databaseUrl: string;
  seedDirectory?: string;
  /** TECH-15: Remote-DB-Hosts zulassen (z. B. Railway Private Network). */
  allowRemoteDatabase?: boolean;
}

export type CatalogServerInstance = FastifyInstance & { readonly catalog: GameSeed[] };

export function validateDatabaseUrl(databaseUrl: string, allowRemote = false): void {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error('A valid DATABASE_URL is required.');
  }

  const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new Error('A valid DATABASE_URL is required.');
  }
  // Lokal: nur localhost-Hosts und keine Query-Parameter. Remote-Hosts nur mit
  // explizitem Opt-in (DATABASE_ALLOW_REMOTE) fuer gehostete Umgebungen.
  if (!allowRemote
    && (!localHosts.has(parsed.hostname.toLowerCase()) || parsed.search !== '')) {
    throw new Error('A valid local DATABASE_URL is required.');
  }
}

export async function startCatalogServer(
  config: ServerConfig,
  options: CatalogServerOptions,
): Promise<CatalogServerInstance> {
  validateDatabaseUrl(options.databaseUrl, options.allowRemoteDatabase === true);

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
    app = buildServer(config, { catalogStore: createCatalogStore(pool) });
    app.decorate('catalog', catalog);
    // FEAT-16: Der Pool bleibt fuer Upload/Loeschung zur Laufzeit offen und
    // wird erst beim Schliessen des Servers beendet.
    app.addHook('onClose', closePool);
    await app.listen({ host: config.host, port: config.port });
    return app as CatalogServerInstance;
  } catch (err) {
    if (app) {
      await app.close().catch(() => undefined);
    }
    await closePool().catch(() => undefined);
    throw new Error('Catalog server failed to start.', { cause: err });
  }
}
