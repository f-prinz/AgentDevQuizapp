import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { GameSeed } from '@raccoons/contracts';
import { deleteGame, initializeCatalog, insertGame, readCatalog } from '../src/catalog.ts';
import { startEphemeralPostgres, type EphemeralPostgres } from './helpers/postgres.ts';

let postgres: EphemeralPostgres;
let pool: Pool;

const quizGame: GameSeed = {
  id: 'catalog_quiz_game',
  kind: 'quiz',
  title: 'Katalog-Quiz',
  rules: 'Regeln.',
  questions: [
    {
      id: 'q1',
      question: 'Erste Frage?',
      options: [
        { id: 'a', text: 'A' },
        { id: 'b', text: 'B' },
        { id: 'c', text: 'C' },
        { id: 'd', text: 'D' },
      ],
      correctOptionId: 'a',
    },
  ],
};

const estimationGame: GameSeed = {
  id: 'catalog_estimation_game',
  kind: 'estimation',
  title: 'Katalog-Schaetzfrage',
  rules: 'Regeln.',
  question: 'Wie viele?',
  target: 42,
};

async function clearCatalogSchema(): Promise<void> {
  await pool.query('DROP TABLE IF EXISTS games, schema_migrations CASCADE');
}

function byId(games: GameSeed[]): GameSeed[] {
  return [...games].sort((left, right) => left.id.localeCompare(right.id));
}

async function insertRow(game: GameSeed, content: unknown = game): Promise<void> {
  await pool.query(
    'INSERT INTO games (id, kind, title, rules, schema_version, content) VALUES ($1, $2, $3, $4, $5, $6::jsonb)',
    [game.id, game.kind, game.title, game.rules, 1, JSON.stringify(content)],
  );
}

describe('PostgreSQL game catalog', () => {
  beforeAll(async () => {
    postgres = await startEphemeralPostgres();
    pool = new Pool({ connectionString: postgres.connectionString });
  }, 120_000);

  afterAll(async () => {
    if (pool) await pool.end();
    if (postgres) await postgres.stop();
  }, 30_000);

  beforeEach(async () => {
    await clearCatalogSchema();
  });

  // CHG-9: Kein initiales Seeding — Initialisierung legt nur die Tabellen an
  // und liefert einen leeren Katalog.
  it('creates catalog and migration tables and starts with an empty catalog', async () => {
    const catalog = await initializeCatalog(pool);
    expect(catalog).toEqual([]);

    const tables = await pool.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name",
    );
    expect(tables.rows.map(row => row.table_name)).toEqual(['games', 'schema_migrations']);
  });

  it('applies migrations idempotently and preserves existing catalog rows', async () => {
    await initializeCatalog(pool);
    await insertRow(quizGame);

    const migrationCountBefore = await pool.query<{ count: string }>('SELECT count(*)::text AS count FROM schema_migrations');
    expect(Number(migrationCountBefore.rows[0]?.count)).toBeGreaterThan(0);

    const catalog = await initializeCatalog(pool);
    expect(byId(catalog)).toEqual(byId([quizGame]));

    const migrationCountAfter = await pool.query<{ count: string }>('SELECT count(*)::text AS count FROM schema_migrations');
    expect(migrationCountAfter.rows[0]?.count).toBe(migrationCountBefore.rows[0]?.count);
  });

  it('validates game content read from PostgreSQL before returning it', async () => {
    await initializeCatalog(pool);
    await insertRow(quizGame);

    const corruptedQuiz = {
      ...quizGame,
      questions: [{ ...quizGame.questions[0], correctOptionId: 'unknown-option' }],
    };
    await pool.query('UPDATE games SET content = $1::jsonb WHERE id = $2', [JSON.stringify(corruptedQuiz), quizGame.id]);

    await expect(readCatalog(pool)).rejects.toThrow();
  });

  it('rejects a corrupted catalog row during initialization without overwriting it', async () => {
    await initializeCatalog(pool);
    await insertRow(estimationGame);
    const corrupted = { ...estimationGame, target: 'not-a-number' };
    await pool.query('UPDATE games SET content = $1::jsonb WHERE id = $2', [JSON.stringify(corrupted), estimationGame.id]);

    await expect(initializeCatalog(pool)).rejects.toThrow();

    const persisted = await pool.query<{ content: unknown }>('SELECT content FROM games WHERE id = $1', [estimationGame.id]);
    expect(persisted.rows[0]?.content).toEqual(corrupted);
  });

  it('inserts and deletes single games via the catalog store functions', async () => {
    await initializeCatalog(pool);

    await insertGame(pool, estimationGame);
    expect(byId(await readCatalog(pool))).toContainEqual(estimationGame);

    expect(await deleteGame(pool, 'unknown-game')).toBe(false);
    expect(await deleteGame(pool, estimationGame.id)).toBe(true);
    expect(await readCatalog(pool)).toEqual([]);
  });
});
