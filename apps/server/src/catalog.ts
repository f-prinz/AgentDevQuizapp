import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GameSeedSchema, type GameSeed } from '@raccoons/contracts';
import type { Pool, PoolClient } from 'pg';

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
  schema_version: number;
  content: unknown;
}

function validateGame(value: unknown): GameSeed {
  const parsed = GameSeedSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error('Catalog game validation failed.');
  }

  return parsed.data;
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

async function readCatalogRows(client: PoolClient): Promise<GameSeed[]> {
  const result = await client.query<GameRow>(
    'SELECT id, kind, title, schema_version, content FROM games ORDER BY id',
  );
  return result.rows.map(parseGameRow);
}

export async function initializeCatalog(pool: Pool): Promise<GameSeed[]> {
  const migrations = await loadMigrations();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await applyMigrations(client, migrations);
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

  const game = validateGame(content);
  if (row.schema_version !== catalogSchemaVersion
    || game.id !== row.id
    || game.kind !== row.kind
    || game.title !== row.title) {
    throw new Error('Catalog contains inconsistent stored game data.');
  }

  return game;
}

export async function insertGame(pool: Pool, game: GameSeed): Promise<void> {
  await pool.query(
    `INSERT INTO games (id, kind, title, schema_version, content)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [game.id, game.kind, game.title, catalogSchemaVersion, JSON.stringify(game)],
  );
}

export async function deleteGame(pool: Pool, id: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM games WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function readCatalog(pool: Pool): Promise<GameSeed[]> {
  try {
    const result = await pool.query<GameRow>(
      'SELECT id, kind, title, schema_version, content FROM games ORDER BY id',
    );
    return result.rows.map(parseGameRow);
  } catch {
    throw new Error('Catalog could not be read or contains invalid data.');
  }
}
