import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { GameSeed } from '@raccoons/contracts';
import { deleteGame, initializeCatalog, insertGame, loadSeedGames, readCatalog } from '../src/catalog.ts';
import { startEphemeralPostgres, type EphemeralPostgres } from './helpers/postgres.ts';

let postgres: EphemeralPostgres;
let pool: Pool;

async function clearCatalogSchema(): Promise<void> {
  await pool.query('DROP TABLE IF EXISTS games, schema_migrations CASCADE');
}

function byId(games: GameSeed[]): GameSeed[] {
  return [...games].sort((left, right) => left.id.localeCompare(right.id));
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

  it('loads and validates default seeds for quiz, sorting, and estimation', async () => {
    const games = await loadSeedGames();

    expect(new Set(games.map(game => game.kind))).toEqual(new Set(['quiz', 'sorting', 'estimation']));
    expect(new Set(games.map(game => game.id)).size).toBe(games.length);

    await initializeCatalog(pool, games);
    expect(byId(await readCatalog(pool))).toEqual(byId(games));
  });

  it('creates only catalog and migration tables, then upserts idempotently without deleting other games', async () => {
    const seeds = await loadSeedGames();
    await initializeCatalog(pool, seeds);

    const tables = await pool.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name",
    );
    expect(tables.rows.map(row => row.table_name)).toEqual(['games', 'schema_migrations']);

    const migrationCountBefore = await pool.query<{ count: string }>('SELECT count(*)::text AS count FROM schema_migrations');
    expect(Number(migrationCountBefore.rows[0]?.count)).toBeGreaterThan(0);

    const quiz = seeds.find(game => game.kind === 'quiz');
    expect(quiz).toBeDefined();
    if (!quiz) throw new Error('The quiz seed is required by the catalog fixture.');

    const foreignGame: GameSeed = {
      id: 'foreign_catalog_entry',
      kind: 'estimation',
      title: 'Externally managed game',
      rules: 'Keep this entry.',
      question: 'How many?',
      target: 42,
    };
    await pool.query(
      'INSERT INTO games (id, kind, title, rules, schema_version, content) VALUES ($1, $2, $3, $4, $5, $6::jsonb)',
      [foreignGame.id, foreignGame.kind, foreignGame.title, foreignGame.rules, 1, JSON.stringify(foreignGame)],
    );

    const updatedSeeds = seeds.map(game => game.id === quiz.id ? { ...game, title: 'Updated seed title' } : game);
    const initializedCatalog = await initializeCatalog(pool, updatedSeeds);
    expect(byId(initializedCatalog)).toContainEqual(foreignGame);
    await initializeCatalog(pool, updatedSeeds);

    const catalog = byId(await readCatalog(pool));
    expect(catalog).toContainEqual({ ...quiz, title: 'Updated seed title' });
    expect(catalog).toContainEqual(foreignGame);
    expect(catalog).toHaveLength(seeds.length + 1);

    const migrationCountAfter = await pool.query<{ count: string }>('SELECT count(*)::text AS count FROM schema_migrations');
    expect(migrationCountAfter.rows[0]?.count).toBe(migrationCountBefore.rows[0]?.count);
  });

  it('validates every seed before writing and leaves the existing catalog unchanged on invalid input', async () => {
    const seeds = await loadSeedGames();
    await initializeCatalog(pool, seeds);
    const originalCatalog = byId(await readCatalog(pool));
    const quiz = seeds.find(game => game.kind === 'quiz');
    const estimation = seeds.find(game => game.kind === 'estimation');

    expect(quiz).toBeDefined();
    expect(estimation).toBeDefined();
    if (!quiz || !estimation) throw new Error('Quiz and estimation seeds are required by this test.');

    const changedQuiz = { ...quiz, title: 'Must not be partially committed' };
    const invalidEstimation = { ...estimation, target: Number.POSITIVE_INFINITY };

    await expect(initializeCatalog(pool, [changedQuiz, invalidEstimation])).rejects.toThrow();
    expect(byId(await readCatalog(pool))).toEqual(originalCatalog);
  });

  it('validates game content read from PostgreSQL before returning it', async () => {
    const seeds = await loadSeedGames();
    await initializeCatalog(pool, seeds);
    const quiz = seeds.find(game => game.kind === 'quiz');

    expect(quiz).toBeDefined();
    if (!quiz || quiz.kind !== 'quiz') throw new Error('A quiz seed is required by this test.');

    const corruptedQuiz = {
      ...quiz,
      questions: quiz.questions.map((question, index) => index === 0
        ? { ...question, correctOptionId: 'unknown-option' }
        : question),
    };
    await pool.query('UPDATE games SET content = $1::jsonb WHERE id = $2', [JSON.stringify(corruptedQuiz), quiz.id]);

    await expect(readCatalog(pool)).rejects.toThrow();
  });

  it('rejects a corrupted unmanaged catalog row during initialization without overwriting it', async () => {
    const seeds = await loadSeedGames();
    await initializeCatalog(pool, seeds);
    const foreignGame: GameSeed = {
      id: 'foreign_catalog_entry',
      kind: 'estimation',
      title: 'Externally managed game',
      rules: 'Keep this entry.',
      question: 'How many?',
      target: 42,
    };
    await pool.query(
      'INSERT INTO games (id, kind, title, rules, schema_version, content) VALUES ($1, $2, $3, $4, $5, $6::jsonb)',
      [foreignGame.id, foreignGame.kind, foreignGame.title, foreignGame.rules, 1, JSON.stringify(foreignGame)],
    );
    const corruptedForeignGame = { ...foreignGame, target: 'not-a-number' };
    await pool.query('UPDATE games SET content = $1::jsonb WHERE id = $2', [JSON.stringify(corruptedForeignGame), foreignGame.id]);

    await expect(initializeCatalog(pool, seeds)).rejects.toThrow();

    const persisted = await pool.query<{ content: unknown }>('SELECT content FROM games WHERE id = $1', [foreignGame.id]);
    expect(persisted.rows[0]?.content).toEqual(corruptedForeignGame);
  });

  it('inserts and deletes single games via the catalog store functions', async () => {
    const seeds = await loadSeedGames();
    await initializeCatalog(pool, seeds);

    const uploaded: GameSeed = {
      id: 'uploaded-catalog-game',
      kind: 'estimation',
      title: 'Hochgeladen',
      rules: 'Regeln.',
      question: 'Frage?',
      target: 7,
    };
    await insertGame(pool, uploaded);
    expect(byId(await readCatalog(pool))).toContainEqual(uploaded);

    expect(await deleteGame(pool, 'unknown-game')).toBe(false);
    expect(await deleteGame(pool, uploaded.id)).toBe(true);
    expect(byId(await readCatalog(pool))).toEqual(byId(seeds));
  });
});
