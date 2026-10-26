import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.ts';

describe('loadConfig', () => {
  it('uses loopback and port 3000 by default', () => {
    expect(loadConfig({})).toEqual({ host: '127.0.0.1', port: 3000 });
  });

  it('accepts a valid configured host and port', () => {
    expect(loadConfig({ HOST: 'localhost', PORT: '8080' })).toEqual({ host: 'localhost', port: 8080 });
  });

  it.each(['', '0', '65536', '-1', '3000abc', '1.5'])('rejects invalid PORT=%s', (PORT) => {
    expect(() => loadConfig({ PORT })).toThrow('Invalid PORT');
  });

  it.each(['', 'not a host', 'http://localhost', 'bad_host'])('rejects invalid HOST=%s', (HOST) => {
    expect(() => loadConfig({ HOST })).toThrow('Invalid HOST');
  });
});
