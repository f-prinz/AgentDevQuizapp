import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { loadConfig } from './config.ts';
import { startServer } from './server.ts';

export async function main(): Promise<void> {
  const app = await startServer(loadConfig());
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
  main().catch(() => {
    console.error('Server startup failed.');
    process.exitCode = 1;
  });
}
