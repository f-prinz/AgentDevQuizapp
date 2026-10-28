import { describe, expect, it } from 'vitest';
import { GAME_CONFIG, type GameSeed } from '@raccoons/contracts';
import { buildServer } from '../src/app.ts';
import { materializeGameDraft } from '../src/catalog-admin.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const quizDraft = {
  kind: 'quiz',
  title: 'Länder',
  questions: [
    {
      question: 'Hauptstadt von Frankreich?',
      options: [
        { text: 'Paris' },
        { text: 'Lyon' },
        { text: 'Marseille' },
        { text: 'Toulouse' },
      ],
      correctOptionIndex: 0,
    },
  ],
};

const sortingDraft = {
  kind: 'sorting',
  title: 'Planeten',
  question: 'Reihenfolge?',
  terms: [
    { text: 'Merkur', value: 1 },
    { text: 'Venus', value: 2 },
  ],
};

const estimationDraft = {
  kind: 'estimation',
  title: 'Eiffelturm',
  question: 'Höhe in Metern?',
  target: 330,
};

describe('materializeGameDraft', () => {
  it('generates UUIDs for the game and all inner ids of a quiz draft via correctOptionIndex', () => {
    const game = materializeGameDraft(quizDraft);
    expect(game.kind).toBe('quiz');
    expect(game.id).toMatch(UUID_PATTERN);
    if (game.kind !== 'quiz') throw new Error('expected quiz');
    const question = game.questions[0]!;
    expect(question.id).toMatch(UUID_PATTERN);
    const optionIds = question.options.map(option => option.id);
    for (const id of optionIds) expect(id).toMatch(UUID_PATTERN);
    expect(new Set(optionIds).size).toBe(optionIds.length);
    expect(question.correctOptionId).toBe(optionIds[0]);
    expect(question.options.map(option => option.text)).toEqual(['Paris', 'Lyon', 'Marseille', 'Toulouse']);
  });

  it('maps a provided correctOptionId reference onto the generated option id', () => {
    const game = materializeGameDraft({
      ...quizDraft,
      questions: [{
        ...quizDraft.questions[0]!,
        options: quizDraft.questions[0]!.options.map((option, index) => ({ ...option, id: `opt-${index}` })),
        correctOptionIndex: undefined,
        correctOptionId: 'opt-2',
      }],
    });
    if (game.kind !== 'quiz') throw new Error('expected quiz');
    const question = game.questions[0]!;
    expect(question.correctOptionId).toBe(question.options[2]!.id);
    expect(question.correctOptionId).toMatch(UUID_PATTERN);
  });

  it('generates UUIDs for sorting term ids', () => {
    const game = materializeGameDraft(sortingDraft);
    if (game.kind !== 'sorting') throw new Error('expected sorting');
    expect(game.id).toMatch(UUID_PATTERN);
    for (const term of game.terms) {
      expect(term.id).toMatch(UUID_PATTERN);
      expect(term.value).toBeGreaterThan(0);
    }
  });

  it('generates the game id for an estimation draft', () => {
    const game = materializeGameDraft(estimationDraft);
    if (game.kind !== 'estimation') throw new Error('expected estimation');
    expect(game.id).toMatch(UUID_PATTERN);
    expect(game.target).toBe(330);
  });

  it('rejects drafts that are not valid GameSeeds', () => {
    expect(() => materializeGameDraft(null)).toThrow();
    expect(() => materializeGameDraft({ kind: 'quiz' })).toThrow();
    expect(() => materializeGameDraft({ ...estimationDraft, target: 'dreihundert' })).toThrow();
    expect(() => materializeGameDraft({ ...quizDraft, questions: [{
      ...quizDraft.questions[0]!,
      correctOptionIndex: undefined,
    }] })).toThrow();
    expect(() => materializeGameDraft({ ...sortingDraft, terms: [{ text: 'A', value: 1 }] })).toThrow();
  });
});

function createStore(games: GameSeed[]) {
  return {
    insert: async (game: GameSeed) => {
      games.push(game);
    },
    remove: async (id: string) => {
      const index = games.findIndex(game => game.id === id);
      if (index < 0) return false;
      games.splice(index, 1);
      return true;
    },
  };
}

const adminConfig = { host: '127.0.0.1', port: 3000, adminToken: 'test-token' };

const existingGame = {
  id: 'existing-game',
  kind: 'estimation',
  title: 'Bestehend',
  question: 'Frage?',
  target: 1,
} satisfies GameSeed;

describe('catalog admin routes', () => {
  it('lists the decorated catalog via GET /games without a token', async () => {
    const app = buildServer({ host: '127.0.0.1', port: 3000 });
    app.decorate('catalog', [existingGame]);
    const response = await app.inject({ method: 'GET', url: '/games' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ games: [{ id: 'existing-game', kind: 'estimation', title: 'Bestehend', rules: GAME_CONFIG.estimation.rules }] });
    await app.close();
  });

  it('rejects POST /games without or with a wrong bearer token', async () => {
    const db: GameSeed[] = [];
    const app = buildServer(adminConfig, { catalogStore: createStore(db) });
    app.decorate('catalog', []);

    const anonymous = await app.inject({ method: 'POST', url: '/games', payload: estimationDraft });
    expect(anonymous.statusCode).toBe(401);
    expect(anonymous.json()).toMatchObject({ code: 'UNAUTHORIZED' });

    const wrong = await app.inject({ method: 'POST', url: '/games', headers: { authorization: 'Bearer wrong' }, payload: estimationDraft });
    expect(wrong.statusCode).toBe(401);
    expect(db).toHaveLength(0);
    await app.close();
  });

  it('does not register upload or delete when no admin token is configured', async () => {
    const app = buildServer({ host: '127.0.0.1', port: 3000 }, { catalogStore: createStore([]) });
    app.decorate('catalog', []);
    const post = await app.inject({ method: 'POST', url: '/games', payload: estimationDraft });
    expect(post.statusCode).toBe(404);
    const del = await app.inject({ method: 'DELETE', url: '/games/abc' });
    expect(del.statusCode).toBe(404);
    await app.close();
  });

  it('uploads a draft, stores it and makes it live in the catalog', async () => {
    const db: GameSeed[] = [existingGame];
    const catalog: GameSeed[] = [existingGame];
    const app = buildServer(adminConfig, { catalogStore: createStore(db) });
    app.decorate('catalog', catalog);

    const response = await app.inject({
      method: 'POST', url: '/games',
      headers: { authorization: 'Bearer test-token' },
      payload: quizDraft,
    });
    expect(response.statusCode).toBe(201);
    const created = response.json().game as { id: string; kind: string; title: string; rules: string };
    expect(created).toMatchObject({ kind: 'quiz', title: 'Länder', rules: GAME_CONFIG.quiz.rules });
    expect(created.id).toMatch(UUID_PATTERN);
    expect(db).toHaveLength(2);
    expect(db[1]!.id).toBe(created.id);
    expect(catalog).toHaveLength(2);
    expect(catalog[1]!.id).toBe(created.id);

    const list = await app.inject({ method: 'GET', url: '/games' });
    expect(list.json().games).toHaveLength(2);
    await app.close();
  });

  it('rejects invalid drafts with 400', async () => {
    const db: GameSeed[] = [];
    const app = buildServer(adminConfig, { catalogStore: createStore(db) });
    app.decorate('catalog', []);
    const response = await app.inject({
      method: 'POST', url: '/games',
      headers: { authorization: 'Bearer test-token' },
      payload: { kind: 'estimation', title: '', question: 'q', target: 'nan' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'INVALID_MESSAGE' });
    expect(db).toHaveLength(0);
    await app.close();
  });

  // CHG-11: Regeln gehoeren zur Spielart (GAME_CONFIG) — ein rules-Feld im
  // Upload wird abgelehnt statt gespeichert.
  it('rejects drafts that carry a rules field', async () => {
    const db: GameSeed[] = [];
    const app = buildServer(adminConfig, { catalogStore: createStore(db) });
    app.decorate('catalog', []);
    const response = await app.inject({
      method: 'POST', url: '/games',
      headers: { authorization: 'Bearer test-token' },
      payload: { ...estimationDraft, rules: 'Eigene Regeln.' },
    });
    expect(response.statusCode).toBe(400);
    expect(db).toHaveLength(0);
    await app.close();
  });

  it('deletes a game via DELETE /games/:gameId and removes it from the catalog', async () => {
    const db: GameSeed[] = [existingGame];
    const catalog: GameSeed[] = [existingGame];
    const app = buildServer(adminConfig, { catalogStore: createStore(db) });
    app.decorate('catalog', catalog);

    const anonymous = await app.inject({ method: 'DELETE', url: `/games/${existingGame.id}` });
    expect(anonymous.statusCode).toBe(401);

    const missing = await app.inject({ method: 'DELETE', url: '/games/unknown-game', headers: { authorization: 'Bearer test-token' } });
    expect(missing.statusCode).toBe(404);

    const removed = await app.inject({ method: 'DELETE', url: `/games/${existingGame.id}`, headers: { authorization: 'Bearer test-token' } });
    expect(removed.statusCode).toBe(204);
    expect(db).toHaveLength(0);
    expect(catalog).toHaveLength(0);
    const list = await app.inject({ method: 'GET', url: '/games' });
    expect(list.json().games).toHaveLength(0);
    await app.close();
  });
});
