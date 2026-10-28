import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { loadConfig } from './config.ts';
import { startCatalogServer } from './bootstrap.ts';

export async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('A local DATABASE_URL is required.');
  }

  const app = await startCatalogServer(loadConfig(), {
    databaseUrl,
    // TECH-15: Remote-DB (z. B. Railway Private Network) nur per Opt-in.
    allowRemoteDatabase: process.env.DATABASE_ALLOW_REMOTE === 'true',
  });
  let shutdown: Promise<void> | undefined;

  const close = (): Promise<void> => {
    shutdown ??= app.close().catch(() => {
      process.exitCode = 1;
    });
    return shutdown;
  };

  process.once('SIGINT', () => { void close(); });
  process.once('SIGTERM', () => { void close(); });
}

const entryPath = process.argv[1];
if (entryPath && import.meta.url === pathToFileURL(entryPath).href) {
  main().catch((err) => {
    console.error('Server startup failed:', err);
    process.exitCode = 1;
  });
}
