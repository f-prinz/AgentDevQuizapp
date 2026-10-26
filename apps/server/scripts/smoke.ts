import process from 'node:process';
import { loadConfig } from '../src/config.ts';
import { startServer } from '../src/server.ts';
import { HealthResponseSchema } from '@raccoons/contracts';

const app = await startServer({ ...loadConfig(), port: 0 });

try {
  const address = app.server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Expected a TCP address.');
  }

  const response = await fetch(`http://127.0.0.1:${address.port}/health`);
  const payload = HealthResponseSchema.parse(await response.json());
  if (response.status !== 200 || payload.status !== 'ok') {
    throw new Error('Health check failed.');
  }

  process.stdout.write('GET /health returned 200; server closed cleanly.\n');
} finally {
  await app.close();
}
