import { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { startCatalogServer } from '../src/bootstrap.ts';
import type { ServerConfig } from '../src/config.ts';

const serverConfig: ServerConfig = { host: '127.0.0.1', port: 0 };

describe('catalog server database URL validation', () => {
  it.each([
    ['plain host query parameter', 'host=example.invalid'],
    ['percent-encoded host query parameter', '%68ost=example.invalid'],
  ])('rejects a remote pg host override from the %s before connecting', async (_label, hostParameter) => {
    const databaseUrl = `postgresql://raccoons:placeholder@127.0.0.1/raccoons_quiz?${hostParameter}`;
    const connectSpy = vi.spyOn(Pool.prototype, 'connect')
      .mockRejectedValue(new Error('The test must not attempt a database connection.'));

    try {
      await expect(startCatalogServer(serverConfig, { databaseUrl })).rejects.toThrow('local DATABASE_URL');
      expect(connectSpy).not.toHaveBeenCalled();
    } finally {
      connectSpy.mockRestore();
    }
  });
});
