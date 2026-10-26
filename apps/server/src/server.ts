import type { FastifyInstance } from 'fastify';
import { buildServer } from './app.ts';
import type { ServerConfig } from './config.ts';

export async function startServer(config: ServerConfig): Promise<FastifyInstance> {
  const app = buildServer(config);

  try {
    await app.listen({ host: config.host, port: config.port });
    return app;
  } catch {
    await app.close().catch(() => undefined);
    throw new Error('Server failed to start.');
  }
}
