import { isIP } from 'node:net';
import process from 'node:process';

export interface ServerConfig {
  host: string;
  port: number;
}

const hostnamePattern = /^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(?:\.(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?))*$/;

function isValidHost(host: string): boolean {
  return isIP(host) !== 0 || hostnamePattern.test(host);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const host = env.HOST ?? '127.0.0.1';
  const rawPort = env.PORT ?? '3000';

  if (!isValidHost(host)) {
    throw new Error('Invalid HOST: expected an IP address or hostname.');
  }

  if (!/^\d+$/.test(rawPort)) {
    throw new Error('Invalid PORT: expected an integer from 1 to 65535.');
  }

  const port = Number(rawPort);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error('Invalid PORT: expected an integer from 1 to 65535.');
  }

  return { host, port };
}
