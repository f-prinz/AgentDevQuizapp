import { isIP } from 'node:net';
import process from 'node:process';

export interface ServerConfig {
  host: string;
  port: number;
  allowedOrigins?: string[];
  adminToken?: string;
  staticDir?: string;
}

const hostnamePattern = /^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(?:\.(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?))*$/;

function isValidHost(host: string): boolean {
  return isIP(host) !== 0 || hostnamePattern.test(host);
}

function parseAllowedOrigins(rawOrigins: string): string[] {
  const origins = rawOrigins.split(',').map(origin => origin.trim()).filter(Boolean);
  if (origins.length === 0) {
    throw new Error('Invalid ALLOWED_ORIGINS: expected one or more HTTP origins.');
  }

  const normalized = origins.map((origin) => {
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error('Invalid ALLOWED_ORIGINS: expected one or more HTTP origins.');
    }
    if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
      || parsed.username !== ''
      || parsed.password !== ''
      || parsed.pathname !== '/'
      || parsed.search !== ''
      || parsed.hash !== '') {
      throw new Error('Invalid ALLOWED_ORIGINS: expected one or more HTTP origins.');
    }
    return parsed.origin;
  });

  return [...new Set(normalized)];
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

  const config: ServerConfig = { host, port };
  if (env.ALLOWED_ORIGINS !== undefined) {
    config.allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS);
  }
  const adminToken = env.ADMIN_TOKEN?.trim();
  if (adminToken) {
    config.adminToken = adminToken;
  }
  const staticDir = env.STATIC_DIR?.trim();
  if (staticDir) {
    config.staticDir = staticDir;
  }
  return config;
}
