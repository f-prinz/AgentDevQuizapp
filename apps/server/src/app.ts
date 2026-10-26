import Fastify, { type FastifyInstance } from 'fastify';
import { ErrorEventSchema, HealthResponseSchema } from '@raccoons/contracts';
import type { ServerConfig } from './config.ts';

const healthResponseJsonSchema = HealthResponseSchema.toJSONSchema();
delete healthResponseJsonSchema.$schema;

function errorResponse(statusCode: number) {
  const notFound = statusCode === 404;
  const badRequest = statusCode === 400;
  return {
    statusCode,
    payload: ErrorEventSchema.parse({
      version: 1,
      type: 'error',
      requestId: null,
      code: notFound ? 'LOBBY_NOT_FOUND' : badRequest ? 'INVALID_MESSAGE' : 'INTERNAL_ERROR',
      message: notFound ? 'Resource not found.' : badRequest ? 'Invalid request.' : 'Internal server error.',
    }),
  };
}

function getStatusCode(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('statusCode' in error)) {
    return undefined;
  }

  const { statusCode } = error;
  return typeof statusCode === 'number' ? statusCode : undefined;
}

export function buildServer(config: ServerConfig): FastifyInstance {
  void config;
  const app = Fastify({ logger: false });

  app.get('/health', {
    schema: {
      response: { 200: healthResponseJsonSchema },
    },
  }, async () => HealthResponseSchema.parse({ status: 'ok', version: 1 }));

  app.setNotFoundHandler((_request, reply) => {
    const error = errorResponse(404);
    return reply.code(error.statusCode).send(error.payload);
  });

  app.setErrorHandler((error, request, reply) => {
    const statusCode = getStatusCode(error) === 400 ? 400 : 500;
    request.log.error({ requestId: request.id, statusCode }, 'Request failed');
    const response = errorResponse(statusCode);
    return reply.code(response.statusCode).send(response.payload);
  });

  return app;
}
