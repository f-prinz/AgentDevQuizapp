import { describe, expect, it } from 'vitest';
import { ErrorEventSchema, HealthResponseSchema } from '@raccoons/contracts';
import { buildServer } from '../src/app.ts';
import { startServer } from '../src/server.ts';

const testConfig = { host: '127.0.0.1', port: 3000 };

describe('HTTP server', () => {
  it('serves the contract health response', async () => {
    const app = buildServer(testConfig);
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(HealthResponseSchema.parse(response.json())).toEqual({ status: 'ok', version: 1 });
    await app.close();
  });

  it('returns sanitized contract errors for unexpected failures', async () => {
    const app = buildServer(testConfig);
    app.get('/test-error', async () => {
      throw new Error('private-secret-value');
    });

    const response = await app.inject({ method: 'GET', url: '/test-error' });
    const payload = ErrorEventSchema.parse(response.json());

    expect(response.statusCode).toBe(500);
    expect(payload).toEqual({
      version: 1,
      type: 'error',
      requestId: null,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error.',
    });
    expect(response.body).not.toContain('private-secret-value');
    await app.close();
  });

  it('sanitizes client request errors as contract errors', async () => {
    const app = buildServer(testConfig);
    app.get('/test-bad-request', async () => {
      throw Object.assign(new Error('private-parser-detail'), { statusCode: 400 });
    });

    const response = await app.inject({ method: 'GET', url: '/test-bad-request' });

    expect(response.statusCode).toBe(400);
    expect(ErrorEventSchema.parse(response.json())).toMatchObject({
      code: 'INVALID_MESSAGE',
      message: 'Invalid request.',
    });
    expect(response.body).not.toContain('private-parser-detail');
    await app.close();
  });

  it('returns a sanitized not-found contract error', async () => {
    const app = buildServer(testConfig);
    const response = await app.inject({ method: 'GET', url: '/missing?token=private-secret-value' });

    expect(response.statusCode).toBe(404);
    expect(ErrorEventSchema.parse(response.json())).toMatchObject({
      code: 'LOBBY_NOT_FOUND',
      message: 'Resource not found.',
    });
    expect(response.body).not.toContain('private-secret-value');
    await app.close();
  });

  it('starts on loopback and closes the listening socket cleanly', async () => {
    const app = await startServer({ host: '127.0.0.1', port: 0 });
    const address = app.server.address();

    try {
      expect(address).not.toBeNull();
      if (!address || typeof address === 'string') {
        throw new Error('Expected a TCP address.');
      }

      const response = await fetch(`http://127.0.0.1:${address.port}/health`);
      expect(response.status).toBe(200);
      expect(HealthResponseSchema.parse(await response.json())).toEqual({ status: 'ok', version: 1 });
    } finally {
      await app.close();
    }

    expect(app.server.listening).toBe(false);
  });
});
