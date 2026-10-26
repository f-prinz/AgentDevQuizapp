import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GameSeedSchema, type GameSeed } from '@raccoons/contracts';
import type { Pool, PoolClient } from 'pg';

const defaultSeedDirectory = fileURLToPath(new URL('../seeds/', import.meta.url));
const migrationDirectory = fileURLToPath(new URL('../migrations/', import.meta.url));
const catalogSchemaVersion = 1;

interface Migration {
  version: string;
  sql: string;
}

interface GameRow {
  id: string;
  kind: string;
  title: string;
  rules: string;
  schema_version: number;
  content: unknown;
}

function validateSeed(value: unknown): GameSeed {
  const parsed = GameSeedSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error('Catalog seed validation failed.');
  }

  return parsed.data;
}

function validateUniqueIds(games: GameSeed[]): void {
  if (new Set(games.map(game => game.id)).size !== games.length) {
    throw new Error('Catalog seeds contain duplicate game IDs.');
  }
}

export async function loadSeedGames(directory?: string): Promise<GameSeed[]> {
  const seedDirectory = directory ?? defaultSeedDirectory;
  let entries;

  try {
    entries = await readdir(seedDirectory, { withFileTypes: true });
  } catch {
    throw new Error('Catalog seed directory could not be read.');
  }

  const files = entries
    .filter(entry => entry.isFile() && path.extname(entry.name).toLowerCase() === '.json')
    .map(entry => entry.name)
    .sort((left, right) => left.localeCompare(right));

  if (files.length === 0) {
    throw new Error('Catalog seed directory contains no JSON files.');
  }

  const games: GameSeed[] = [];
  for (const filename of files) {
    let content: string;
    try {
      content = await readFile(path.join(seedDirectory, filename), 'utf8');
    } catch {
      throw new Error('Catalog seed file could not be read.');
    }

    let value: unknown;
    try {
      value = JSON.parse(content) as unknown;
    } catch {
      throw new Error('Catalog seed file contains invalid JSON.');
    }

    games.push(validateSeed(value));
  }

  validateUniqueIds(games);
  return games;
}

async function loadMigrations(): Promise<Migration[]> {
  let entries;
  try {
    entries = await readdir(migrationDirectory, { withFileTypes: true });
  } catch {
    throw new Error('Catalog migrations could not be read.');
  }

  const filenames = entries
    .filter(entry => entry.isFile() && path.extname(entry.name).toLowerCase() === '.sql')
    .map(entry => entry.name)
    .sort((left, right) => left.localeCompare(right));

  if (filenames.length === 0) {
    throw new Error('Catalog migrations are missing.');
  }

  const migrations: Migration[] = [];
  for (const filename of filenames) {
    let sql: string;
    try {
      sql = await readFile(path.join(migrationDirectory, filename), 'utf8');
    } catch {
      throw new Error('Catalog migration file could not be read.');
    }

    migrations.push({ version: path.basename(filename, path.extname(filename)), sql });
  }

  return migrations;
}

async function applyMigrations(client: PoolClient, migrations: Migration[]): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  for (const migration of migrations) {
    const result = await client.query<{ version: string }>(
      'SELECT version FROM schema_migrations WHERE version = $1',
      [migration.version],
    );
    if (result.rowCount !== 0) continue;

    await client.query(migration.sql);
    await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [migration.version]);
  }
}

async function applySeeds(client: PoolClient, games: GameSeed[]): Promise<void> {
  for (const game of games) {
    await client.query(
      `INSERT INTO games (id, kind, title, rules, schema_version, content)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         kind = EXCLUDED.kind,
         title = EXCLUDED.title,
         rules = EXCLUDED.rules,
         schema_version = EXCLUDED.schema_version,
         content = EXCLUDED.content`,
      [game.id, game.kind, game.title, game.rules, catalogSchemaVersion, JSON.stringify(game)],
    );
  }
}

async function readCatalogRows(client: PoolClient): Promise<GameSeed[]> {
  const result = await client.query<GameRow>(
    'SELECT id, kind, title, rules, schema_version, content FROM games ORDER BY id',
  );
  return result.rows.map(parseGameRow);
}

export async function initializeCatalog(pool: Pool, seeds: unknown[]): Promise<GameSeed[]> {
  if (!Array.isArray(seeds) || seeds.length === 0) {
    throw new Error('Catalog seeds must contain at least one game.');
  }

  const games = seeds.map(validateSeed);
  validateUniqueIds(games);
  const migrations = await loadMigrations();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await applyMigrations(client, migrations);
    await applySeeds(client, games);
    const catalog = await readCatalogRows(client);
    await client.query('COMMIT');
    return catalog;
  } catch {
    await client.query('ROLLBACK').catch(() => undefined);
    throw new Error('Catalog initialization failed.');
  } finally {
    client.release();
  }
}

function parseGameRow(row: GameRow): GameSeed {
  let content = row.content;
  if (typeof content === 'string') {
    try {
      content = JSON.parse(content) as unknown;
    } catch {
      throw new Error('Catalog contains invalid stored game content.');
    }
  }

  const game = validateSeed(content);
  if (row.schema_version !== catalogSchemaVersion
    || game.id !== row.id
    || game.kind !== row.kind
    || game.title !== row.title
    || game.rules !== row.rules) {
    throw new Error('Catalog contains inconsistent stored game data.');
  }

  return game;
}

export async function readCatalog(pool: Pool): Promise<GameSeed[]> {
  try {
    const result = await pool.query<GameRow>(
      'SELECT id, kind, title, rules, schema_version, content FROM games ORDER BY id',
    );
    return result.rows.map(parseGameRow);
  } catch {
    throw new Error('Catalog could not be read or contains invalid data.');
  }
}
