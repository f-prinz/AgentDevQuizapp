import { afterEach, describe, expect, it, vi } from 'vitest';
import WebSocket from 'ws';
import {
  CreateLobbyResponseSchema,
  ErrorEventSchema,
  GAME_CONFIG,
  GameSeedSchema,
  JoinPlayerResponseSchema,
  ServerMessageSchema,
  SnapshotSchema,
  type ServerMessage,
  type Session,
} from '@raccoons/contracts';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/app.ts';

const origin = 'http://127.0.0.1:5173';
const config = { host: '127.0.0.1', port: 0, allowedOrigins: [origin] };
const games = [
  GameSeedSchema.parse({
    id: 'quiz_game', kind: 'quiz', title: 'Quiz',    questions: [{
      id: 'quiz_q1', question: 'Which option is correct?',
      options: [
        { id: 'a', text: 'A' }, { id: 'b', text: 'B' },
        { id: 'c', text: 'C' }, { id: 'd', text: 'D' },
      ],
      correctOptionId: 'c',
    }],
  }),
  GameSeedSchema.parse({
    id: 'sorting_game', kind: 'sorting', title: 'Sort',    question: 'Order these terms.',
    terms: [{ id: 'term_a', text: 'First', value: 1 }, { id: 'term_b', text: 'Second', value: 2 }],
  }),
  GameSeedSchema.parse({
    id: 'estimate_game', kind: 'estimation', title: 'Estimate',    question: 'How many?', target: 42,
  }),
];
const multiQuestionQuiz = GameSeedSchema.parse({
  id: 'quiz_game', kind: 'quiz', title: 'Quiz',  questions: [
    {
      id: 'quiz_q1', question: 'Which option is correct?',
      options: [
        { id: 'a', text: 'A' }, { id: 'b', text: 'B' },
        { id: 'c', text: 'C' }, { id: 'd', text: 'D' },
      ],
      correctOptionId: 'c',
    },
    {
      id: 'quiz_q2', question: 'Which option comes next?',
      options: [
        { id: 'a2', text: 'A2' }, { id: 'b2', text: 'B2' },
        { id: 'c2', text: 'C2' }, { id: 'd2', text: 'D2' },
      ],
      correctOptionId: 'b2',
    },
  ],
});
const estimate100Game = GameSeedSchema.parse({
  id: 'estimate_game', kind: 'estimation', title: 'Estimate',  question: 'How many?', target: 100,
});
const estimateMaxGame = GameSeedSchema.parse({
  id: 'estimate_game', kind: 'estimation', title: 'Estimate',  question: 'How many?', target: Number.MAX_VALUE,
});

type BuildServerOptions = { now?: () => number };
type Predicate = (message: ServerMessage) => boolean;
interface Inbox { waitFor(predicate: Predicate, timeoutMs?: number): Promise<ServerMessage> }
interface TestServer { app: FastifyInstance; baseUrl: string; wsUrl: string }
interface Client { socket: WebSocket; inbox: Inbox; snapshot: ReturnType<typeof SnapshotSchema.parse> }
interface RoundFixture {
  server: TestServer;
  lobby: ReturnType<typeof CreateLobbyResponseSchema.parse>;
  host: Client;
  projector: Client;
  players: [Client, Client];
  playerSessions: [Session, Session];
  roundId: string;
  playing: [ReturnType<typeof SnapshotSchema.parse>, ReturnType<typeof SnapshotSchema.parse>, ReturnType<typeof SnapshotSchema.parse>];
}

const servers: TestServer[] = [];
const sockets: WebSocket[] = [];
let requestSequence = 0;

function inboxFor(socket: WebSocket): Inbox {
  const messages: ServerMessage[] = [];
  const waiters: Array<{
    predicate: Predicate;
    resolve: (message: ServerMessage) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }> = [];
  let parseError: Error | undefined;

  socket.on('message', raw => {
    try {
      const message = ServerMessageSchema.parse(JSON.parse(raw.toString()) as unknown);
      const waiterIndex = waiters.findIndex(waiter => waiter.predicate(message));
      if (waiterIndex < 0) {
        messages.push(message);
        return;
      }
      const [waiter] = waiters.splice(waiterIndex, 1);
      if (!waiter) return;
      clearTimeout(waiter.timer);
      waiter.resolve(message);
    } catch (error) {
      parseError = error instanceof Error ? error : new Error('Invalid server message.');
      for (const waiter of waiters.splice(0)) {
        clearTimeout(waiter.timer);
        waiter.reject(parseError);
      }
    }
  });

  return {
    waitFor(predicate, timeoutMs = 2_000) {
      if (parseError) return Promise.reject(parseError);
      const queuedIndex = messages.findIndex(predicate);
      if (queuedIndex >= 0) {
        const [message] = messages.splice(queuedIndex, 1);
        if (message) return Promise.resolve(message);
      }
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          const waiterIndex = waiters.findIndex(waiter => waiter.resolve === resolve);
          if (waiterIndex >= 0) waiters.splice(waiterIndex, 1);
          reject(new Error('Timed out waiting for a WebSocket message.'));
        }, timeoutMs);
        waiters.push({ predicate, resolve, reject, timer });
      });
    },
  };
}

function makeClock() {
  let value = Date.now();
  return { now: () => value, set: (next: number) => { value = next; } };
}

async function startServer(options?: BuildServerOptions, catalog: unknown[] = games): Promise<TestServer> {
  const app = options ? buildServer(config, options) : buildServer(config);
  app.decorate('catalog', catalog);
  await app.listen(config);
  const address = app.server.address();
  if (!address || typeof address === 'string') throw new Error('Expected a TCP listener.');
  const server = {
    app,
    baseUrl: `http://127.0.0.1:${address.port}`,
    wsUrl: `ws://127.0.0.1:${address.port}/ws`,
  };
  servers.push(server);
  return server;
}

async function createLobby(server: TestServer) {
  const response = await fetch(`${server.baseUrl}/lobbies`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
  });
  expect(response.status).toBe(201);
  return CreateLobbyResponseSchema.parse(await response.json());
}

async function joinPlayer(server: TestServer, lobbyId: string, name: string): Promise<Session> {
  const response = await fetch(`${server.baseUrl}/lobbies/${lobbyId}/players`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }),
  });
  expect(response.status).toBe(201);
  return JoinPlayerResponseSchema.parse(await response.json()).session;
}

async function connect(server: TestServer, session: Session): Promise<Client> {
  const socket = new WebSocket(server.wsUrl, { origin });
  sockets.push(socket);
  const inbox = inboxFor(socket);
  await new Promise<void>((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });
  const requestId = `auth_${session.role}_${session.sessionId}`;
  const ack = inbox.waitFor(message => message.type === 'ack' && message.requestId === requestId);
  const snapshot = inbox.waitFor(message => message.type === 'snapshot' && message.role === session.role);
  socket.send(JSON.stringify({
    version: 1, type: 'auth', requestId,
    lobbyId: session.lobbyId, sessionId: session.sessionId, token: session.token,
  }));
  await ack;
  const authSnapshot = SnapshotSchema.parse(await snapshot);
  return { socket, inbox, snapshot: authSnapshot };
}

async function command(client: Client, type: string, values: Record<string, unknown> = {}): Promise<ServerMessage> {
  const requestId = `request_${++requestSequence}`;
  const response = client.inbox.waitFor(message =>
    (message.type === 'ack' || message.type === 'error') && message.requestId === requestId,
  );
  client.socket.send(JSON.stringify({ version: 1, requestId, type, ...values }));
  return response;
}

async function snapshot(client: Client, predicate: (value: ReturnType<typeof SnapshotSchema.parse>) => boolean) {
  return SnapshotSchema.parse(await client.inbox.waitFor(message =>
    message.type === 'snapshot' && predicate(SnapshotSchema.parse(message)),
  ));
}

async function beginRound(
  kind: 'quiz' | 'sorting' | 'estimation',
  clock = makeClock(),
  catalog: unknown[] = games,
): Promise<RoundFixture> {
  const server = await startServer({ now: clock.now }, catalog);
  const lobby = await createLobby(server);
  const playerSessions = [
    await joinPlayer(server, lobby.lobbyId, 'Player one'),
    await joinPlayer(server, lobby.lobbyId, 'Player two'),
  ] as [Session, Session];
  const [host, projector, playerOne, playerTwo] = await Promise.all([
    connect(server, lobby.host),
    connect(server, lobby.projector),
    connect(server, playerSessions[0]),
    connect(server, playerSessions[1]),
  ]);

  expect((await command(host, 'lobby.start')).type).toBe('ack');
  await snapshot(host, value => value.phase === 'overview');
  const gameId = kind === 'estimation' ? 'estimate_game' : `${kind}_game`;
  expect((await command(host, 'game.select', { gameId })).type).toBe('ack');
  expect((await command(host, 'game.prepare')).type).toBe('ack');
  const starting = await snapshot(host, value => value.phase === 'start');
  if (!starting.round) throw new Error('Expected a prepared round.');
  const roundId = starting.round.roundId;

  expect((await command(host, 'game.start', { roundId })).type).toBe('ack');
  const playing = await Promise.all([
    snapshot(host, value => value.phase === 'playing'),
    snapshot(projector, value => value.phase === 'playing'),
    snapshot(playerOne, value => value.phase === 'playing'),
  ]);
  return { server, lobby, host, projector, players: [playerOne, playerTwo], playerSessions, roundId, playing };
}

async function closeSocket(socket: WebSocket): Promise<void> {
  if (socket.readyState === WebSocket.CLOSED) return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out waiting for WebSocket close.')), 2_000);
    socket.once('close', () => { clearTimeout(timer); resolve(); });
    socket.close();
  });
}

afterEach(async () => {
  vi.restoreAllMocks();
  for (const socket of sockets.splice(0)) socket.terminate();
  for (const server of servers.splice(0)) await server.app.close();
});

describe('server game state and round timers', () => {
  it.each([
    { kind: 'quiz' as const, seconds: 30 },
    { kind: 'sorting' as const, seconds: 60 },
    { kind: 'estimation' as const, seconds: 30 },
  ])('starts a $kind round with its role-safe task and $seconds-second deadline', async ({ kind, seconds }) => {
    const clock = makeClock();
    const round = await beginRound(kind, clock);
    const [host, projector, player] = round.playing;
    for (const view of [host, projector, player]) {
      expect(view.phase).toBe('playing');
      expect(view.round?.phase).toBe('playing');
      if (view.round?.phase !== 'playing') throw new Error('Expected a playing round.');
      expect(view.round.timer.deadline - view.round.timer.serverTime).toBe(seconds * 1_000);
      expect(view.round.timer.acceptUntil).toBe(view.round.timer.deadline + 2_000);
      expect(view.round.timer.inputClosed).toBe(false);
    }
    expect(projector.round?.phase === 'playing' && projector.round.task).not.toHaveProperty('options');
    expect(JSON.stringify([host, projector, player])).not.toContain('correctOptionId');
    if (kind === 'sorting') {
      const playerRound = player.round;
      expect(playerRound?.phase === 'playing' && playerRound.task.kind === 'sorting').toBe(true);
      if (player.role === 'player' && player.round?.phase === 'playing' && player.round.task.kind === 'sorting') {
        expect(player.round.task.terms[0]).not.toHaveProperty('value');
      }
      expect(JSON.stringify([host, projector, player])).not.toContain('"value":');
    }
    if (kind === 'estimation') expect(JSON.stringify([host, projector, player])).not.toContain('"target":');
  });

  it('scores each quiz question once from the last valid selection and finishes only after the final question', async () => {
    const clock = makeClock();
    const round = await beginRound('quiz', clock, [multiQuestionQuiz]);
    const [hostFirst, , playerOneFirst] = round.playing;
    if (hostFirst.role !== 'host' || hostFirst.round?.phase !== 'playing' || playerOneFirst.role !== 'player'
      || playerOneFirst.round?.phase !== 'playing' || playerOneFirst.round.task.kind !== 'quiz') {
      throw new Error('Expected the first quiz question to be playing.');
    }
    expect(hostFirst.round.questionIndex).toBe(0);
    expect(hostFirst.round.task.kind).toBe('quiz');
    expect(hostFirst.round.task.question).toBe('Which option is correct?');
    expect(hostFirst.round.timer.deadline - hostFirst.round.timer.serverTime).toBe(30_000);
    const firstDeadline = hostFirst.round.timer.deadline;
    expect(playerOneFirst.round.task.options.map(option => option.id)).toEqual(['a', 'b', 'c', 'd']);

    expect((await command(round.players[0], 'answer.set', {
      roundId: round.roundId, answer: { kind: 'quiz', optionId: 'a' },
    })).type).toBe('ack');
    expect((await command(round.players[0], 'answer.set', {
      roundId: round.roundId, answer: { kind: 'quiz', optionId: 'c' },
    })).type).toBe('ack');
    expect((await command(round.players[0], 'answer.submit', {
      roundId: round.roundId, answer: { kind: 'quiz', optionId: 'c' },
    })).type).toBe('ack');
    expect((await command(round.players[1], 'answer.submit', {
      roundId: round.roundId, answer: { kind: 'quiz', optionId: 'a' },
    })).type).toBe('ack');
    expect((await command(round.host, 'game.reveal', { roundId: round.roundId })).type).toBe('ack');

    const firstEvaluation = await snapshot(round.host, value => value.phase === 'evaluation'
      && value.round?.roundId === round.roundId);
    if (firstEvaluation.role !== 'host' || firstEvaluation.round?.phase !== 'evaluation'
      || firstEvaluation.round.solution.kind !== 'quiz') {
      throw new Error('Expected the first quiz question evaluation.');
    }
    expect(firstEvaluation.round.questionIndex).toBe(0);
    expect(firstEvaluation.round.solution.correctOptionId).toBe('c');
    expect(firstEvaluation.round.hasNextQuestion).toBe(true);
    expect(firstEvaluation.round.results.map(result => result.playerId)).toEqual([
      round.playing[2].role === 'player' ? round.playing[2].playerId : '',
      round.players[1].snapshot.role === 'player' ? round.players[1].snapshot.playerId : '',
    ]);
    // TECH-17: Erwartung aus der Spielart-Konfiguration ableiten statt hart.
    const quizPoints = GAME_CONFIG.quiz.scoring.pointsPerCorrectAnswer;
    expect(firstEvaluation.round.results.map(result => result.points)).toEqual([quizPoints, 0]);
    const firstPlayerEvaluation = await snapshot(round.players[0], value => value.phase === 'evaluation'
      && value.round?.roundId === round.roundId);
    if (firstPlayerEvaluation.role !== 'player' || firstPlayerEvaluation.round?.phase !== 'evaluation') {
      throw new Error('Expected the first player quiz evaluation.');
    }
    expect(firstPlayerEvaluation.round.ownEvaluation).toMatchObject({
      answer: { kind: 'quiz', optionId: 'c' }, points: quizPoints,
    });
    expect(ErrorEventSchema.parse(await command(round.host, 'game.reveal', { roundId: round.roundId })))
      .toMatchObject({ code: 'INVALID_PHASE' });
    expect(ErrorEventSchema.parse(await command(round.host, 'game.finish', { roundId: round.roundId })))
      .toMatchObject({ code: 'INVALID_PHASE' });

    clock.set(clock.now() + 1_000);
    expect((await command(round.host, 'game.next', { roundId: round.roundId })).type).toBe('ack');
    const secondPlaying = await snapshot(round.host, value => value.phase === 'playing'
      && value.round?.questionIndex === 1);
    if (secondPlaying.role !== 'host' || secondPlaying.round?.phase !== 'playing'
      || secondPlaying.round.task.kind !== 'quiz') {
      throw new Error('Expected the host to advance to the second quiz question.');
    }
    const secondRoundId = secondPlaying.round.roundId;
    expect(secondRoundId).not.toBe(round.roundId);
    expect(secondPlaying.round.task.question).toBe('Which option comes next?');
    expect(secondPlaying.round.task.kind === 'quiz'
      ? secondPlaying.round.task.options.map(option => option.id)
      : []).toEqual(['a2', 'b2', 'c2', 'd2']);
    expect(secondPlaying.round.timer.deadline - secondPlaying.round.timer.serverTime).toBe(30_000);
    expect(secondPlaying.round.timer.deadline).toBeGreaterThan(firstDeadline);
    expect(secondPlaying.phase).toBe('playing');

    expect((await command(round.players[0], 'answer.submit', {
      roundId: secondRoundId, answer: { kind: 'quiz', optionId: 'a2' },
    })).type).toBe('ack');
    expect((await command(round.players[1], 'answer.submit', {
      roundId: secondRoundId, answer: { kind: 'quiz', optionId: 'b2' },
    })).type).toBe('ack');
    expect((await command(round.host, 'game.reveal', { roundId: secondRoundId })).type).toBe('ack');
    const lastEvaluation = await snapshot(round.host, value => value.phase === 'evaluation'
      && value.round?.roundId === secondRoundId);
    if (lastEvaluation.role !== 'host' || lastEvaluation.round?.phase !== 'evaluation'
      || lastEvaluation.round.solution.kind !== 'quiz') {
      throw new Error('Expected the last quiz question evaluation.');
    }
    expect(lastEvaluation.round.questionIndex).toBe(1);
    expect(lastEvaluation.round.solution.correctOptionId).toBe('b2');
    expect(lastEvaluation.round.hasNextQuestion).toBe(false);
    expect(lastEvaluation.round.results.map(result => result.points)).toEqual([0, quizPoints]);
    expect(ErrorEventSchema.parse(await command(round.host, 'game.next', { roundId: secondRoundId })))
      .toMatchObject({ code: 'INVALID_PHASE' });
    expect((await command(round.host, 'game.finish', { roundId: secondRoundId })).type).toBe('ack');
    expect(await snapshot(round.host, value => value.phase === 'overview')).toMatchObject({
      phase: 'overview', round: null,
    });
  });

  it('publishes completed quiz totals, tied competition ranks, and played status to host and projector', async () => {
    const clock = makeClock();
    const catalog = [multiQuestionQuiz, games[1], games[2]];
    const server = await startServer({ now: clock.now }, catalog);
    const lobby = await createLobby(server);
    const playerSessions = [
      await joinPlayer(server, lobby.lobbyId, 'Player one'),
      await joinPlayer(server, lobby.lobbyId, 'Player two'),
      await joinPlayer(server, lobby.lobbyId, 'Player three'),
    ] as [Session, Session, Session];
    const host = await connect(server, lobby.host);
    const projector = await connect(server, lobby.projector);
    const players = await Promise.all(playerSessions.map(session => connect(server, session)));
    const playerIds = players.map(player => {
      if (player.snapshot.role !== 'player') throw new Error('Expected a player session.');
      return player.snapshot.playerId;
    });

    expect((await command(host, 'lobby.start')).type).toBe('ack');
    const initialOverview = await snapshot(host, value => value.phase === 'overview');
    // CHG-12: Die Rangliste enthaelt alle Spieler auch vor dem ersten Spiel.
    const initialRanking = [
      { playerId: playerIds[0], name: 'Player one', rank: 1, total: 0, games: [] },
      { playerId: playerIds[1], name: 'Player two', rank: 1, total: 0, games: [] },
      { playerId: playerIds[2], name: 'Player three', rank: 1, total: 0, games: [] },
    ];
    expect(initialOverview.ranking).toEqual(initialRanking);
    const initialPlayerSnapshots = await Promise.all(players.map(player => snapshot(player,
      value => value.phase === 'overview')));
    for (const [index, playerSnapshot] of initialPlayerSnapshots.entries()) {
      expect(playerSnapshot.role).toBe('player');
      expect(playerSnapshot.ranking).toEqual([initialRanking[index]]);
    }
    expect(initialOverview.catalog.find(game => game.id === 'quiz_game')?.played).toBe(false);
    expect(initialOverview.catalog.find(game => game.id === 'sorting_game')?.played).toBe(false);
    expect(initialOverview.catalog.find(game => game.id === 'estimate_game')?.played).toBe(false);
    expect((await command(host, 'game.select', { gameId: 'quiz_game' })).type).toBe('ack');
    expect((await command(host, 'game.prepare')).type).toBe('ack');
    const firstStart = await snapshot(host, value => value.phase === 'start');
    if (firstStart.role !== 'host' || firstStart.round?.phase !== 'start') {
      throw new Error('Expected the first quiz question to be prepared.');
    }
    const firstRoundId = firstStart.round.roundId;
    expect((await command(host, 'game.start', { roundId: firstRoundId })).type).toBe('ack');
    await snapshot(host, value => value.phase === 'playing' && value.round?.questionIndex === 0);

    const submitQuestion = async (roundId: string, choices: [string, string, string]) => {
      const answers = await Promise.all(players.map((player, index) => command(player, 'answer.submit', {
        roundId,
        answer: { kind: 'quiz', optionId: choices[index]! },
      })));
      expect(answers.map(answer => answer.type)).toEqual(['ack', 'ack', 'ack']);
    };
    await submitQuestion(firstRoundId, ['c', 'c', 'a']);
    expect((await command(host, 'game.reveal', { roundId: firstRoundId })).type).toBe('ack');
    const firstEvaluation = await snapshot(host, value => value.phase === 'evaluation'
      && value.round?.roundId === firstRoundId);
    // CHG-12: Waehrend der Runde enthaelt games einen Eintrag fuer das laufende Spiel.
    const preparedRanking = initialRanking.map(entry => ({ ...entry, games: [{ gameId: 'quiz_game', points: 0 }] }));
    // TECH-17: Quiz-Punktzahl aus der Spielart-Konfiguration ableiten statt hart.
    const quizPoints = GAME_CONFIG.quiz.scoring.pointsPerCorrectAnswer;
    const firstRanking = [
      { playerId: playerIds[0], name: 'Player one', rank: 1, total: quizPoints, games: [{ gameId: 'quiz_game', points: quizPoints }] },
      { playerId: playerIds[1], name: 'Player two', rank: 1, total: quizPoints, games: [{ gameId: 'quiz_game', points: quizPoints }] },
      { playerId: playerIds[2], name: 'Player three', rank: 3, total: 0, games: [{ gameId: 'quiz_game', points: 0 }] },
    ];
    expect(firstEvaluation.ranking).toEqual(firstRanking);
    expect(firstEvaluation.rankingTransition).toMatchObject({
      gameId: 'quiz_game',
      previous: preparedRanking,
      current: firstRanking,
    });
    expect(firstEvaluation.catalog.find(game => game.id === 'quiz_game')?.played).toBe(false);

    clock.set(clock.now() + 1_000);
    expect((await command(host, 'game.next', { roundId: firstRoundId })).type).toBe('ack');
    const secondPlaying = await snapshot(host, value => value.phase === 'playing'
      && value.round?.questionIndex === 1);
    if (secondPlaying.role !== 'host' || secondPlaying.round?.phase !== 'playing') {
      throw new Error('Expected the second quiz question to be playing.');
    }
    const secondRoundId = secondPlaying.round.roundId;
    await submitQuestion(secondRoundId, ['b2', 'b2', 'a2']);
    expect((await command(host, 'game.reveal', { roundId: secondRoundId })).type).toBe('ack');
    const finalEvaluation = await snapshot(host, value => value.phase === 'evaluation'
      && value.round?.roundId === secondRoundId);
    const expectedRanking = [
      { playerId: playerIds[0], name: 'Player one', rank: 1, total: 2 * quizPoints, games: [{ gameId: 'quiz_game', points: 2 * quizPoints }] },
      { playerId: playerIds[1], name: 'Player two', rank: 1, total: 2 * quizPoints, games: [{ gameId: 'quiz_game', points: 2 * quizPoints }] },
      { playerId: playerIds[2], name: 'Player three', rank: 3, total: 0, games: [{ gameId: 'quiz_game', points: 0 }] },
    ];
    expect(finalEvaluation.ranking).toEqual(expectedRanking);
    expect(finalEvaluation.rankingTransition).toMatchObject({
      previous: firstRanking,
      current: expectedRanking,
    });
    expect(finalEvaluation.catalog.find(game => game.id === 'quiz_game')?.played).toBe(false);

    expect((await command(host, 'game.finish', { roundId: secondRoundId })).type).toBe('ack');
    const [completedHost, completedProjector] = await Promise.all([
      snapshot(host, value => value.phase === 'overview' && value.revision > finalEvaluation.revision),
      snapshot(projector, value => value.phase === 'overview' && value.revision > finalEvaluation.revision),
    ]);
    if (completedHost.role !== 'host' || completedProjector.role !== 'projector') {
      throw new Error('Expected completed ranking snapshots for host and projector.');
    }

    expect(completedHost.ranking).toEqual(expectedRanking);
    expect(completedProjector.ranking).toEqual(expectedRanking);
    const completedPlayerSnapshots = await Promise.all(players.map(player => snapshot(player,
      value => value.phase === 'overview' && value.revision >= completedHost.revision)));
    for (const [index, playerSnapshot] of completedPlayerSnapshots.entries()) {
      expect(playerSnapshot.role).toBe('player');
      expect(playerSnapshot.ranking).toEqual([expectedRanking[index]]);
      expect(playerSnapshot.ranking.every(entry => entry.playerId === playerIds[index])).toBe(true);
    }
    // BUG-6: Die Transition der letzten Aufloesung ist beim Beenden konsumiert —
    // kein stale rankingTransition mehr im Overview-Snapshot (Inhalt wurde oben
    // bereits auf dem Evaluation-Snapshot geprueft).
    expect(completedHost.rankingTransition).toBeNull();
    expect(completedProjector.rankingTransition).toBeNull();
    expect(completedHost.catalog.find(game => game.id === 'quiz_game')?.played).toBe(true);
    expect(completedProjector.catalog.find(game => game.id === 'quiz_game')?.played).toBe(true);
    expect(completedHost.catalog.find(game => game.id === 'sorting_game')?.played).toBe(false);
    expect(completedHost.catalog.find(game => game.id === 'estimate_game')?.played).toBe(false);
  });

  it('publishes a completed sorting game to the catalog and ranking transition', async () => {
    const round = await beginRound('sorting');
    const [playingHost, , firstPlayerPlaying] = round.playing;
    if (playingHost.role !== 'host' || playingHost.round?.phase !== 'playing'
      || firstPlayerPlaying.role !== 'player' || firstPlayerPlaying.round?.phase !== 'playing'
      || firstPlayerPlaying.input.answer?.kind !== 'sorting') {
      throw new Error('Expected the sorting round and initial player order.');
    }
    const secondPlayerPlaying = await snapshot(round.players[1], value => value.phase === 'playing');
    if (secondPlayerPlaying.role !== 'player' || secondPlayerPlaying.input.answer?.kind !== 'sorting') {
      throw new Error('Expected the second player initial sorting order.');
    }
    expect(playingHost.catalog.find(game => game.id === 'sorting_game')?.played).toBe(false);
    expect(playingHost.rankingTransition).toBeNull();

    for (const [player, answer] of [
      [round.players[0], firstPlayerPlaying.input.answer],
      [round.players[1], secondPlayerPlaying.input.answer],
    ] as const) {
      expect((await command(player, 'answer.submit', { roundId: round.roundId, answer })).type).toBe('ack');
    }
    expect((await command(round.host, 'game.reveal', { roundId: round.roundId })).type).toBe('ack');
    const [hostEvaluation, projectorEvaluation] = await Promise.all([
      snapshot(round.host, value => value.phase === 'evaluation' && value.round?.roundId === round.roundId),
      snapshot(round.projector, value => value.phase === 'evaluation' && value.round?.roundId === round.roundId),
    ]);
    expect(hostEvaluation.catalog.find(game => game.id === 'sorting_game')?.played).toBe(false);
    expect(projectorEvaluation.catalog.find(game => game.id === 'sorting_game')?.played).toBe(false);
    // CHG-12: Die Transition feuert bereits bei der Aufloesung — die Rangliste
    // aktualisiert sich pro Frage statt erst beim Beenden des Spiels.
    expect(hostEvaluation.rankingTransition).not.toBeNull();
    expect(projectorEvaluation.rankingTransition).not.toBeNull();

    expect((await command(round.host, 'game.finish', { roundId: round.roundId })).type).toBe('ack');
    const [completedHost, completedProjector] = await Promise.all([
      snapshot(round.host, value => value.phase === 'overview' && value.revision > hostEvaluation.revision),
      snapshot(round.projector, value => value.phase === 'overview' && value.revision > hostEvaluation.revision),
    ]);
    if (completedHost.role !== 'host' || completedProjector.role !== 'projector') {
      throw new Error('Expected completed sorting ranking snapshots for host and projector.');
    }

    expect(completedHost.catalog.find(game => game.id === 'sorting_game')?.played).toBe(true);
    expect(completedProjector.catalog.find(game => game.id === 'sorting_game')?.played).toBe(true);
    expect(completedHost.ranking).toHaveLength(2);
    expect(completedProjector.ranking).toEqual(completedHost.ranking);
    // BUG-6: Die Transition der Aufloesung ist beim Beenden konsumiert —
    // kein stale rankingTransition mehr im Overview-Snapshot.
    expect(completedHost.rankingTransition).toBeNull();
    expect(completedProjector.rankingTransition).toBeNull();
    for (const entry of completedHost.ranking) {
      expect(entry.games.map(game => game.gameId)).toEqual(['sorting_game']);
      expect(entry.total).toBe(entry.games[0]?.points);
    }
  });

  it('scores sorting positions, reveals the value order, and carries points into completed ranking', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const sortingSeed = GameSeedSchema.parse({
      id: 'sorting_game', kind: 'sorting', title: 'Sort',      question: 'Put the terms in value order.',
      terms: [
        { id: 'term_b', text: 'Second', value: 2 },
        { id: 'term_c', text: 'Third', value: 3 },
        { id: 'term_a', text: 'First', value: 1 },
      ],
    });
    const round = await beginRound('sorting', makeClock(), [sortingSeed]);
    const [hostPlaying, projectorPlaying, firstPlayerPlaying] = round.playing;
    const secondPlayerPlaying = await snapshot(round.players[1], value => value.phase === 'playing');
    if (hostPlaying.role !== 'host' || hostPlaying.round?.phase !== 'playing'
      || hostPlaying.round.task.kind !== 'sorting'
      || projectorPlaying.role !== 'projector' || projectorPlaying.round?.phase !== 'playing'
      || projectorPlaying.round.task.kind !== 'sorting'
      || firstPlayerPlaying.role !== 'player' || firstPlayerPlaying.round?.phase !== 'playing'
      || firstPlayerPlaying.round.task.kind !== 'sorting'
      || secondPlayerPlaying.role !== 'player' || secondPlayerPlaying.round?.phase !== 'playing'
      || secondPlayerPlaying.round.task.kind !== 'sorting') {
      throw new Error('Expected the sorting task in every round view.');
    }
    const canonicalOrder = ['term_a', 'term_b', 'term_c'];
    for (const playerView of [firstPlayerPlaying, secondPlayerPlaying]) {
      if (playerView.role !== 'player' || playerView.round?.phase !== 'playing'
      ) {
        throw new Error('Expected a player sorting task.');
      }
      const playerRound = playerView.round;
      if (playerRound.task.kind !== 'sorting') throw new Error('Expected sorting terms.');
      const sortingTask = playerRound.task;
      const termIds = sortingTask.terms.map(term => term.id);
      expect([...termIds].sort()).toEqual([...canonicalOrder].sort());
      expect(termIds).not.toEqual(canonicalOrder);
      expect(sortingTask.terms.every(term => !('value' in term))).toBe(true);
      expect(playerRound.timer.deadline - playerRound.timer.serverTime).toBe(60_000);
    }
    expect(hostPlaying.round.timer.deadline - hostPlaying.round.timer.serverTime).toBe(60_000);
    expect(projectorPlaying.round.timer.deadline - projectorPlaying.round.timer.serverTime).toBe(60_000);
    expect(JSON.stringify([hostPlaying, projectorPlaying, firstPlayerPlaying, secondPlayerPlaying]))
      .not.toContain('"value":');

    const firstPlayerId = firstPlayerPlaying.playerId;
    const secondPlayerId = secondPlayerPlaying.playerId;
    const answers = [
      { player: round.players[0], termIds: canonicalOrder },
      { player: round.players[1], termIds: ['term_b', 'term_a', 'term_c'] },
    ];
    for (const { player, termIds } of answers) {
      expect((await command(player, 'answer.submit', {
        roundId: round.roundId, answer: { kind: 'sorting', termIds },
      })).type).toBe('ack');
    }
    expect((await command(round.host, 'game.reveal', { roundId: round.roundId })).type).toBe('ack');
    const [hostEvaluation, projectorEvaluation, firstPlayerEvaluation, secondPlayerEvaluation] = await Promise.all([
      snapshot(round.host, value => value.phase === 'evaluation' && value.round?.roundId === round.roundId),
      snapshot(round.projector, value => value.phase === 'evaluation' && value.round?.roundId === round.roundId),
      snapshot(round.players[0], value => value.phase === 'evaluation' && value.round?.roundId === round.roundId),
      snapshot(round.players[1], value => value.phase === 'evaluation' && value.round?.roundId === round.roundId),
    ]);
    if (hostEvaluation.role !== 'host' || hostEvaluation.round?.phase !== 'evaluation'
      || hostEvaluation.round.solution.kind !== 'sorting'
      || projectorEvaluation.role !== 'projector' || projectorEvaluation.round?.phase !== 'evaluation'
      || projectorEvaluation.round.solution.kind !== 'sorting'
      || firstPlayerEvaluation.role !== 'player' || firstPlayerEvaluation.round?.phase !== 'evaluation'
      || firstPlayerEvaluation.round.solution.kind !== 'sorting'
      || secondPlayerEvaluation.role !== 'player' || secondPlayerEvaluation.round?.phase !== 'evaluation'
      || secondPlayerEvaluation.round.solution.kind !== 'sorting') {
      throw new Error('Expected sorting evaluation results for all roles.');
    }
    const solution = hostEvaluation.round.solution.terms;
    expect(solution.map(term => [term.id, term.value])).toEqual([
      ['term_a', 1], ['term_b', 2], ['term_c', 3],
    ]);
    expect(projectorEvaluation.round.solution).toEqual(hostEvaluation.round.solution);
    expect(firstPlayerEvaluation.round.solution).toEqual(hostEvaluation.round.solution);
    expect(secondPlayerEvaluation.round.solution).toEqual(hostEvaluation.round.solution);
    expect(firstPlayerEvaluation.round.ownEvaluation).toMatchObject({
      answer: { kind: 'sorting', termIds: canonicalOrder }, points: 3, positionsCorrect: [true, true, true],
    });
    // BUG-9: Abwaerts-Regel — term_b ist erster Term (richtig), term_a mit
    // Wert 1 nach Wert 2 ist die Abwaertsstelle (falsch), term_c folgt auf 1
    // und ist damit richtig einsortiert.
    expect(secondPlayerEvaluation.round.ownEvaluation).toMatchObject({
      answer: { kind: 'sorting', termIds: ['term_b', 'term_a', 'term_c'] },
      points: 2, positionsCorrect: [true, false, true],
    });
    // BUG-8: Sorting-Ergebnisse tragen die Platzierung (Rang aus Punkten,
    // Ties teilen den Rang) — bisher kam rank null und der Projektor zeigte '-'.
    const expectedResults = [
      { playerId: firstPlayerId, points: 3, errors: 0, rank: 1 },
      { playerId: secondPlayerId, points: 2, errors: 1, rank: 2 },
    ];
    for (const evaluation of [hostEvaluation.round, projectorEvaluation.round]) {
      expect(evaluation.results).toEqual(expect.arrayContaining(expectedResults.map(result =>
        expect.objectContaining(result),
      )));
    }

    expect((await command(round.host, 'game.finish', { roundId: round.roundId })).type).toBe('ack');
    const [completedHost, completedProjector] = await Promise.all([
      snapshot(round.host, value => value.phase === 'overview' && value.revision > hostEvaluation.revision),
      snapshot(round.projector, value => value.phase === 'overview' && value.revision > hostEvaluation.revision),
    ]);
    if (completedHost.role !== 'host' || completedProjector.role !== 'projector') {
      throw new Error('Expected completed ranking snapshots for host and projector.');
    }
    for (const [playerId, points] of [[firstPlayerId, 3], [secondPlayerId, 2]] as const) {
      for (const ranking of [completedHost.ranking, completedProjector.ranking]) {
        expect(ranking.find(entry => entry.playerId === playerId)?.games).toContainEqual({
          gameId: 'sorting_game', points,
        });
      }
    }
  });

  // BUG-9: Abwaerts-Regel — ein Term zaehlt als richtig, wenn sein Wert
  // groesser ist als der des unmittelbar vorherigen Terms; der erste Term
  // zaehlt immer. Deckt die vier Nutzer-Faelle ab (8 Punkte bei korrekter
  // Reihenfolge, 7 bei Verschiebung, 7 bei Tausch, 6 bei zwei Abwaertsstellen).
  it('scores sorting terms by the descent rule for the four reported cases', async () => {
    const clock = makeClock();
    const sortingSeed = GameSeedSchema.parse({
      id: 'sorting_game', kind: 'sorting', title: 'Planeten', question: 'Nach Sonnennaehe sortieren.',
      terms: ['merkur', 'venus', 'erde', 'mars', 'jupiter', 'saturn', 'uranus', 'neptun']
        .map((id, index) => ({ id, text: id, value: index + 1 })),
    });
    const server = await startServer({ now: clock.now }, [sortingSeed]);
    const lobby = await createLobby(server);
    const playerSessions = await Promise.all(
      ['P1', 'P2', 'P3', 'P4'].map(name => joinPlayer(server, lobby.lobbyId, name)),
    );
    const [host, , ...players] = await Promise.all([
      connect(server, lobby.host),
      connect(server, lobby.projector),
      ...playerSessions.map(session => connect(server, session)),
    ]);
    expect((await command(host, 'lobby.start')).type).toBe('ack');
    await snapshot(host, value => value.phase === 'overview');
    expect((await command(host, 'game.select', { gameId: 'sorting_game' })).type).toBe('ack');
    expect((await command(host, 'game.prepare')).type).toBe('ack');
    const starting = await snapshot(host, value => value.phase === 'start');
    if (!starting.round) throw new Error('Expected a prepared round.');
    const roundId = starting.round.roundId;
    expect((await command(host, 'game.start', { roundId })).type).toBe('ack');
    await Promise.all(players.map(player => snapshot(player, value => value.phase === 'playing')));

    const orders = [
      ['merkur', 'venus', 'erde', 'mars', 'jupiter', 'saturn', 'uranus', 'neptun'],
      ['venus', 'erde', 'mars', 'jupiter', 'saturn', 'uranus', 'neptun', 'merkur'],
      ['merkur', 'erde', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptun'],
      ['merkur', 'mars', 'erde', 'jupiter', 'saturn', 'uranus', 'venus', 'neptun'],
    ];
    for (const [index, player] of players.entries()) {
      expect((await command(player, 'answer.submit', {
        roundId, answer: { kind: 'sorting', termIds: orders[index] },
      })).type).toBe('ack');
    }
    expect((await command(host, 'game.reveal', { roundId })).type).toBe('ack');
    const evaluations = await Promise.all(
      players.map(player => snapshot(player, value => value.phase === 'evaluation')),
    );
    const expected = [
      { points: 8, positionsCorrect: [true, true, true, true, true, true, true, true] },
      { points: 7, positionsCorrect: [true, true, true, true, true, true, true, false] },
      { points: 7, positionsCorrect: [true, true, false, true, true, true, true, true] },
      { points: 6, positionsCorrect: [true, true, false, true, true, true, false, true] },
    ];
    for (const [index, evaluation] of evaluations.entries()) {
      if (evaluation.role !== 'player' || evaluation.round?.phase !== 'evaluation') {
        throw new Error('Expected a player evaluation snapshot.');
      }
      const expectedCase = expected[index]!;
      expect(evaluation.round.ownEvaluation).toMatchObject({
        points: expectedCase.points,
        positionsCorrect: expectedCase.positionsCorrect,
      });
    }
  });

  it('scores valid estimates by six-player rank groups and carries them into completed ranking', async () => {
    const clock = makeClock();
    const server = await startServer({ now: clock.now }, [estimate100Game]);
    const lobby = await createLobby(server);
    const playerSessions: Session[] = [];
    for (const name of ['Estimate one', 'Estimate two', 'Estimate three', 'Estimate four', 'Estimate five', 'Estimate six', 'No estimate']) {
      playerSessions.push(await joinPlayer(server, lobby.lobbyId, name));
    }
    const host = await connect(server, lobby.host);
    const projector = await connect(server, lobby.projector);
    const players = await Promise.all(playerSessions.map(session => connect(server, session)));
    const playerIds = players.map(player => {
      if (player.snapshot.role !== 'player') throw new Error('Expected a player session.');
      return player.snapshot.playerId;
    });

    expect((await command(host, 'lobby.start')).type).toBe('ack');
    await snapshot(host, value => value.phase === 'overview');
    expect((await command(host, 'game.select', { gameId: 'estimate_game' })).type).toBe('ack');
    expect((await command(host, 'game.prepare')).type).toBe('ack');
    const prepared = await snapshot(host, value => value.phase === 'start');
    if (prepared.role !== 'host' || prepared.round?.phase !== 'start') {
      throw new Error('Expected an estimation round to be prepared.');
    }
    const roundId = prepared.round.roundId;
    expect((await command(host, 'game.start', { roundId })).type).toBe('ack');
    const [playingHost, playingProjector, ...playingPlayers] = await Promise.all([
      snapshot(host, value => value.phase === 'playing'),
      snapshot(projector, value => value.phase === 'playing'),
      ...players.map(player => snapshot(player, value => value.phase === 'playing')),
    ]);
    if (playingHost?.role !== 'host' || playingHost.round?.phase !== 'playing'
      || playingProjector?.role !== 'projector' || playingProjector.round?.phase !== 'playing') {
      throw new Error('Expected host and projector estimation rounds to be playing.');
    }
    expect(playingHost.round.timer.deadline - playingHost.round.timer.serverTime).toBe(30_000);
    expect(playingProjector.round.timer.deadline - playingProjector.round.timer.serverTime).toBe(30_000);
    for (const playerView of playingPlayers) {
      if (playerView.role !== 'player' || playerView.round?.phase !== 'playing'
        || playerView.round.task.kind !== 'estimation') {
        throw new Error('Expected each player to receive the estimation question.');
      }
      expect(playerView.round.timer.deadline - playerView.round.timer.serverTime).toBe(30_000);
    }
    expect(JSON.stringify([playingHost, playingProjector, ...playingPlayers])).not.toContain('"target"');

    const firstPlayer = players[0];
    const firstSession = playerSessions[0];
    if (!firstPlayer || !firstSession) throw new Error('Expected the first estimate player.');
    expect((await command(firstPlayer, 'answer.set', {
      roundId, answer: { kind: 'estimation', value: 99 },
    })).type).toBe('ack');
    expect((await command(firstPlayer, 'answer.set', {
      roundId, answer: { kind: 'estimation', value: 100 },
    })).type).toBe('ack');
    expect(ErrorEventSchema.parse(await command(firstPlayer, 'answer.submit', {
      roundId, answer: { kind: 'estimation', value: Number.NaN },
    }))).toMatchObject({ code: 'INVALID_MESSAGE' });
    await closeSocket(firstPlayer.socket);
    const reconnectedFirst = await connect(server, firstSession);
    if (reconnectedFirst.snapshot.role !== 'player') throw new Error('Expected the same player session.');
    expect(reconnectedFirst.snapshot.input).toMatchObject({
      answer: { kind: 'estimation', value: 100 }, final: false, participating: true,
    });

    const estimates = [100, 99, 101, 98, 102, 90];
    const validPlayers = [reconnectedFirst, ...players.slice(1, 6)];
    for (const [index, player] of validPlayers.entries()) {
      expect((await command(player, 'answer.submit', {
        roundId, answer: { kind: 'estimation', value: estimates[index]! },
      })).type).toBe('ack');
    }
    const timer = playingHost.round.timer;
    clock.set(timer.acceptUntil + 1);
    await snapshot(host, value => value.phase === 'playing' && value.round?.phase === 'playing'
      && value.round.timer.inputClosed);
    expect((await command(host, 'game.reveal', { roundId })).type).toBe('ack');
    const [hostEvaluation, projectorEvaluation, ...playerEvaluations] = await Promise.all([
      snapshot(host, value => value.phase === 'evaluation' && value.round?.roundId === roundId),
      snapshot(projector, value => value.phase === 'evaluation' && value.round?.roundId === roundId),
      ...[reconnectedFirst, ...players.slice(1)].map(player => snapshot(player,
        value => value.phase === 'evaluation' && value.round?.roundId === roundId)),
    ]);
    if (hostEvaluation?.role !== 'host' || hostEvaluation.round?.phase !== 'evaluation'
      || hostEvaluation.round.solution.kind !== 'estimation'
      || projectorEvaluation?.role !== 'projector' || projectorEvaluation.round?.phase !== 'evaluation'
      || projectorEvaluation.round.solution.kind !== 'estimation') {
      throw new Error('Expected value-backed estimation evaluation views.');
    }
    expect(hostEvaluation.round.solution.target).toBe(100);
    expect(projectorEvaluation.round.solution).toEqual(hostEvaluation.round.solution);
    const expected = [
      { distance: 0, rank: 1, points: 5 },
      { distance: 1, rank: 2, points: 3 },
      { distance: 1, rank: 2, points: 3 },
      { distance: 2, rank: 4, points: 1 },
      { distance: 2, rank: 4, points: 1 },
      { distance: 10, rank: 6, points: 0 },
      { distance: null, rank: null, points: 0 },
    ];
    for (const evaluation of [hostEvaluation.round, projectorEvaluation.round]) {
      expect(evaluation.results).toHaveLength(expected.length);
      for (const [index, expectedResult] of expected.entries()) {
        expect(evaluation.results.find(result => result.playerId === playerIds[index])).toMatchObject({
          ...expectedResult, playerId: playerIds[index],
        });
      }
    }
    for (const [index, playerEvaluation] of playerEvaluations.entries()) {
      if (playerEvaluation?.role !== 'player' || playerEvaluation.round?.phase !== 'evaluation'
        || playerEvaluation.round.solution.kind !== 'estimation') {
        throw new Error('Expected each estimate player evaluation.');
      }
      expect(playerEvaluation.round.ownEvaluation).toMatchObject({
        points: expected[index]?.points,
        distance: expected[index]?.distance,
      });
    }

    expect((await command(host, 'game.finish', { roundId })).type).toBe('ack');
    const completed = await snapshot(host, value => value.phase === 'overview'
      && value.revision > hostEvaluation.revision);
    if (completed.role !== 'host') throw new Error('Expected the completed estimation ranking.');
    for (const [index, expectedResult] of expected.entries()) {
      expect(completed.ranking.find(entry => entry.playerId === playerIds[index])).toMatchObject({
        total: expectedResult.points,
        games: [{ gameId: 'estimate_game', points: expectedResult.points }],
      });
    }
  });

  it('awards every equally closest estimate the five-point maximum', async () => {
    const round = await beginRound('estimation', makeClock(), [estimate100Game]);
    for (const player of round.players) {
      expect((await command(player, 'answer.submit', {
        roundId: round.roundId, answer: { kind: 'estimation', value: 100 },
      })).type).toBe('ack');
    }
    expect((await command(round.host, 'game.reveal', { roundId: round.roundId })).type).toBe('ack');
    const [hostEvaluation, ...playerEvaluations] = await Promise.all([
      snapshot(round.host, value => value.phase === 'evaluation' && value.round?.roundId === round.roundId),
      ...round.players.map(player => snapshot(player,
        value => value.phase === 'evaluation' && value.round?.roundId === round.roundId)),
    ]);
    if (hostEvaluation?.role !== 'host' || hostEvaluation.round?.phase !== 'evaluation'
      || hostEvaluation.round.solution.kind !== 'estimation') {
      throw new Error('Expected host estimate results.');
    }
    expect(hostEvaluation.round.results.map(result => ({ rank: result.rank, distance: result.distance, points: result.points })))
      .toEqual([
        { rank: 1, distance: 0, points: 5 },
        { rank: 1, distance: 0, points: 5 },
      ]);
    for (const playerEvaluation of playerEvaluations) {
      if (playerEvaluation?.role !== 'player' || playerEvaluation.round?.phase !== 'evaluation'
        || playerEvaluation.round.solution.kind !== 'estimation') {
        throw new Error('Expected player estimate evaluation.');
      }
      expect(playerEvaluation.round.ownEvaluation).toMatchObject({
        answer: { kind: 'estimation', value: 100 }, points: 5, distance: 0,
      });
    }
  });

  it('keeps extreme finite estimate distances serializable and finite after reveal', async () => {
    const round = await beginRound('estimation', makeClock(), [estimateMaxGame]);
    expect((await command(round.players[0], 'answer.submit', {
      roundId: round.roundId, answer: { kind: 'estimation', value: Number.MAX_VALUE },
    })).type).toBe('ack');
    expect((await command(round.players[1], 'answer.submit', {
      roundId: round.roundId, answer: { kind: 'estimation', value: -Number.MAX_VALUE },
    })).type).toBe('ack');
    expect((await command(round.host, 'game.reveal', { roundId: round.roundId })).type).toBe('ack');
    const [hostEvaluation, projectorEvaluation] = await Promise.all([
      snapshot(round.host, value => value.phase === 'evaluation' && value.round?.roundId === round.roundId),
      snapshot(round.projector, value => value.phase === 'evaluation' && value.round?.roundId === round.roundId),
    ]);
    if (hostEvaluation.role !== 'host' || hostEvaluation.round?.phase !== 'evaluation'
      || hostEvaluation.round.solution.kind !== 'estimation'
      || projectorEvaluation.role !== 'projector' || projectorEvaluation.round?.phase !== 'evaluation'
      || projectorEvaluation.round.solution.kind !== 'estimation') {
      throw new Error('Expected valid host and projector estimate snapshots.');
    }
    expect(hostEvaluation.round.solution.target).toBe(Number.MAX_VALUE);
    expect(projectorEvaluation.round.solution.target).toBe(Number.MAX_VALUE);

    const firstPlayerSnapshot = round.playing[2];
    const secondPlayerSnapshot = round.players[1].snapshot;
    if (firstPlayerSnapshot.role !== 'player' || secondPlayerSnapshot.role !== 'player') {
      throw new Error('Expected both estimate player identities.');
    }
    const exactMatch = hostEvaluation.round.results.find(result => result.playerId === firstPlayerSnapshot.playerId);
    const farEstimate = hostEvaluation.round.results.find(result => result.playerId === secondPlayerSnapshot.playerId);
    expect(exactMatch).toMatchObject({ rank: 1, distance: 0, points: 5 });
    expect(farEstimate).toMatchObject({ rank: 2, points: 1 });
    expect(typeof farEstimate?.distance).toBe('number');
    expect(Number.isFinite(farEstimate?.distance)).toBe(true);
    expect(projectorEvaluation.round.results).toEqual(hostEvaluation.round.results);
  });

  it('gives unanswered estimates zero points and no rank or bonus when N is zero', async () => {
    const clock = makeClock();
    const round = await beginRound('estimation', clock, [estimate100Game]);
    const [hostPlaying] = round.playing;
    if (hostPlaying.role !== 'host' || hostPlaying.round?.phase !== 'playing'
      || hostPlaying.round.task.kind !== 'estimation') {
      throw new Error('Expected an active estimation timer.');
    }
    expect(hostPlaying.round.timer.deadline - hostPlaying.round.timer.serverTime).toBe(30_000);
    clock.set(hostPlaying.round.timer.acceptUntil + 1);
    await snapshot(round.host, value => value.phase === 'playing' && value.round?.phase === 'playing'
      && value.round.timer.inputClosed);
    expect((await command(round.host, 'game.reveal', { roundId: round.roundId })).type).toBe('ack');
    const [hostEvaluation, projectorEvaluation, firstPlayerEvaluation, secondPlayerEvaluation] = await Promise.all([
      snapshot(round.host, value => value.phase === 'evaluation' && value.round?.roundId === round.roundId),
      snapshot(round.projector, value => value.phase === 'evaluation' && value.round?.roundId === round.roundId),
      snapshot(round.players[0], value => value.phase === 'evaluation' && value.round?.roundId === round.roundId),
      snapshot(round.players[1], value => value.phase === 'evaluation' && value.round?.roundId === round.roundId),
    ]);
    for (const evaluation of [hostEvaluation, projectorEvaluation]) {
      if (evaluation.role !== 'host' && evaluation.role !== 'projector') {
        throw new Error('Expected host/projector evaluation results.');
      }
      if (evaluation.round?.phase !== 'evaluation' || evaluation.round.solution.kind !== 'estimation') {
        throw new Error('Expected an estimation solution.');
      }
      expect(evaluation.round.solution.target).toBe(100);
      expect(evaluation.round.results).toHaveLength(2);
      expect(evaluation.round.results.map(result => ({ points: result.points, rank: result.rank, distance: result.distance })))
        .toEqual([
          { points: 0, rank: null, distance: null },
          { points: 0, rank: null, distance: null },
        ]);
    }
    for (const playerEvaluation of [firstPlayerEvaluation, secondPlayerEvaluation]) {
      if (playerEvaluation.role !== 'player' || playerEvaluation.round?.phase !== 'evaluation'
        || playerEvaluation.round.solution.kind !== 'estimation') {
        throw new Error('Expected player estimate evaluation.');
      }
      expect(playerEvaluation.round.ownEvaluation).toMatchObject({
        answer: null, points: 0, distance: null,
      });
    }
  });

  it('keeps sorting solutions hidden from late players and preserves their shuffled task on reauth', async () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    const round = await beginRound('sorting');
    const lateSession = await joinPlayer(round.server, round.lobby.lobbyId, 'Late player');
    const latePlayer = await connect(round.server, lateSession);
    const firstSnapshot = latePlayer.snapshot;
    if (firstSnapshot.role !== 'player' || firstSnapshot.round?.phase !== 'playing'
      || firstSnapshot.round.task.kind !== 'sorting') {
      throw new Error('Expected the late player to receive a sorting round.');
    }
    const firstTermIds = firstSnapshot.round.task.terms.map(term => term.id);
    expect(firstTermIds).toEqual(['term_b', 'term_a']);
    expect(firstTermIds).not.toEqual(['term_a', 'term_b']);
    expect(firstSnapshot.round.task.terms.every(term => !('value' in term))).toBe(true);
    expect(firstSnapshot.input.participating).toBe(false);
    expect(firstSnapshot.participants.find(participant => participant.name === 'Late player')?.waiting).toBe(true);

    await closeSocket(latePlayer.socket);
    random.mockReturnValue(0.999);
    const reauthenticated = await connect(round.server, lateSession);
    const restored = reauthenticated.snapshot;
    if (restored.role !== 'player' || restored.round?.phase !== 'playing' || restored.round.task.kind !== 'sorting') {
      throw new Error('Expected the late player sorting round to be restored.');
    }
    expect(restored.round.task.terms.map(term => term.id)).toEqual(firstTermIds);
    expect(restored.input.participating).toBe(false);
    expect(restored.participants.find(participant => participant.name === 'Late player')?.waiting).toBe(true);

    const lateAnswer = { kind: 'sorting', termIds: ['term_b', 'term_a'] };
    expect(ErrorEventSchema.parse(await command(reauthenticated, 'answer.set', {
      roundId: round.roundId, answer: lateAnswer,
    }))).toMatchObject({ code: 'NOT_PARTICIPATING' });
    expect(ErrorEventSchema.parse(await command(reauthenticated, 'answer.submit', {
      roundId: round.roundId, answer: lateAnswer,
    }))).toMatchObject({ code: 'NOT_PARTICIPATING' });

    for (const player of round.players) {
      expect((await command(player, 'answer.submit', {
        roundId: round.roundId,
        answer: { kind: 'sorting', termIds: ['term_a', 'term_b'] },
      })).type).toBe('ack');
    }
    const allFrozenPlayersFinished = await snapshot(round.host, value => value.phase === 'playing'
      && value.round?.phase === 'playing' && value.round.timer.inputClosed);
    expect(allFrozenPlayersFinished.round?.phase === 'playing' && allFrozenPlayersFinished.round.timer.canReveal)
      .toBe(true);
  });

  it('deselects and reselects in overview, advances a two-question quiz, and returns waiting players after finish', async () => {
    const clock = makeClock();
    const server = await startServer({ now: clock.now }, [multiQuestionQuiz]);
    const lobby = await createLobby(server);
    const playerSessions = [
      await joinPlayer(server, lobby.lobbyId, 'Player one'),
      await joinPlayer(server, lobby.lobbyId, 'Player two'),
    ] as [Session, Session];
    const [host, playerOne, playerTwo] = await Promise.all([
      connect(server, lobby.host),
      connect(server, playerSessions[0]),
      connect(server, playerSessions[1]),
    ]);

    expect((await command(host, 'lobby.start')).type).toBe('ack');
    await snapshot(host, value => value.phase === 'overview');
    expect((await command(host, 'game.select', { gameId: 'quiz_game' })).type).toBe('ack');
    expect((await snapshot(host, value => value.phase === 'overview' && value.selectedGameId === 'quiz_game')).selectedGameId)
      .toBe('quiz_game');
    expect((await command(host, 'game.select', { gameId: null })).type).toBe('ack');
    expect((await snapshot(host, value => value.phase === 'overview' && value.selectedGameId === null)).selectedGameId)
      .toBeNull();
    expect((await command(host, 'game.select', { gameId: 'quiz_game' })).type).toBe('ack');
    expect((await command(host, 'game.prepare')).type).toBe('ack');
    const start = await snapshot(host, value => value.phase === 'start');
    if (!start.round) throw new Error('Expected the prepared quiz round.');
    const firstRoundId = start.round.roundId;
    expect((await command(host, 'game.start', { roundId: firstRoundId })).type).toBe('ack');
    const firstPlaying = await snapshot(host, value => value.phase === 'playing');
    if (firstPlaying.round?.phase !== 'playing') throw new Error('Expected the first question to play.');
    const firstDeadline = firstPlaying.round.timer.deadline;
    expect(firstPlaying.round.questionIndex).toBe(0);
    expect(firstPlaying.round.questionCount).toBe(2);

    const lateSession = await joinPlayer(server, lobby.lobbyId, 'Late player');
    const latePlayer = await connect(server, lateSession);
    const lateInFirstQuestion = latePlayer.snapshot;
    expect(lateInFirstQuestion.participants.find(participant => participant.name === 'Late player')?.waiting).toBe(true);
    if (lateInFirstQuestion.role === 'player') expect(lateInFirstQuestion.input.participating).toBe(false);

    for (const player of [playerOne, playerTwo]) {
      expect((await command(player, 'answer.submit', {
        roundId: firstRoundId,
        answer: { kind: 'quiz', optionId: 'a' },
      })).type).toBe('ack');
    }
    expect((await command(host, 'game.reveal', { roundId: firstRoundId })).type).toBe('ack');
    const firstEvaluation = await snapshot(host, value => value.phase === 'evaluation');
    if (firstEvaluation.round?.phase !== 'evaluation') throw new Error('Expected the first question evaluation.');
    expect(firstEvaluation.round.hasNextQuestion).toBe(true);

    clock.set(clock.now() + 1_000);
    expect((await command(host, 'game.next', { roundId: firstRoundId })).type).toBe('ack');
    const secondTransition = await snapshot(host, value => value.round?.questionIndex === 1);
    expect(secondTransition.phase).toBe('playing');
    const secondPlaying = secondTransition;
    if (secondPlaying.round?.phase !== 'playing') throw new Error('Expected the next quiz question to enter playing directly.');
    const secondRoundId = secondPlaying.round.roundId;
    expect(secondRoundId).not.toBe(firstRoundId);
    expect(secondPlaying.round.timer.deadline).toBeGreaterThan(firstDeadline);
    expect(secondPlaying.round.questionIndex).toBe(1);
    const secondPlayerSnapshot = await snapshot(playerOne, value => value.role === 'player'
      && value.phase === 'playing' && value.round?.questionIndex === 1);
    if (secondPlayerSnapshot.role !== 'player' || secondPlayerSnapshot.round?.phase !== 'playing') {
      throw new Error('Expected the player snapshot for the second question.');
    }
    expect(secondPlayerSnapshot.input).toMatchObject({ answer: null, final: false, participating: true });
    expect(ErrorEventSchema.parse(await command(playerOne, 'answer.set', {
      roundId: firstRoundId,
      answer: { kind: 'quiz', optionId: 'a2' },
    }))).toMatchObject({ code: 'STALE_ROUND' });
    const lateInSecondQuestion = await snapshot(latePlayer, value => value.role === 'player'
      && value.phase === 'playing' && value.round?.questionIndex === 1);
    expect(lateInSecondQuestion.participants.find(participant => participant.name === 'Late player')?.waiting).toBe(true);
    if (lateInSecondQuestion.role === 'player') expect(lateInSecondQuestion.input.participating).toBe(false);

    for (const player of [playerOne, playerTwo]) {
      expect((await command(player, 'answer.submit', {
        roundId: secondRoundId,
        answer: { kind: 'quiz', optionId: 'b2' },
      })).type).toBe('ack');
    }
    expect((await command(host, 'game.reveal', { roundId: secondRoundId })).type).toBe('ack');
    const lastEvaluation = await snapshot(host, value => value.phase === 'evaluation');
    if (lastEvaluation.round?.phase !== 'evaluation') throw new Error('Expected the last question evaluation.');
    expect(lastEvaluation.round.hasNextQuestion).toBe(false);
    expect(ErrorEventSchema.parse(await command(host, 'game.next', { roundId: secondRoundId })))
      .toMatchObject({ code: 'INVALID_PHASE' });
    expect((await command(host, 'game.finish', { roundId: secondRoundId })).type).toBe('ack');
    expect(await snapshot(host, value => value.phase === 'overview')).toMatchObject({ phase: 'overview', round: null });
    const lateAfterFinish = await snapshot(latePlayer, value => value.phase === 'overview');
    expect(lateAfterFinish.participants.find(participant => participant.name === 'Late player')?.waiting).toBe(false);
  });

  it('accepts an answer at deadline plus 2s, closes after it, and allows only the host to reveal', async () => {
    const clock = makeClock();
    const round = await beginRound('quiz', clock);
    const timer = round.playing[0].round;
    if (!timer || timer.phase !== 'playing') throw new Error('Expected a running timer.');
    const answer = { kind: 'quiz', optionId: 'a' };

    clock.set(timer.timer.acceptUntil);
    expect((await command(round.players[0], 'answer.submit', { roundId: round.roundId, answer })).type).toBe('ack');
    const inclusiveBoundary = await snapshot(round.host, value => value.phase === 'playing' && value.round?.phase === 'playing');
    if (inclusiveBoundary.round?.phase !== 'playing') throw new Error('Expected the round to remain open at the inclusive boundary.');
    expect(inclusiveBoundary.round.timer.inputClosed).toBe(false);
    expect((await command(round.host, 'game.reveal', { roundId: round.roundId })).type).toBe('error');

    clock.set(timer.timer.acceptUntil + 1);
    const closed = await snapshot(round.host, value => value.phase === 'playing'
      && value.round?.phase === 'playing' && value.round.timer.inputClosed);
    expect(closed.round?.phase === 'playing' && closed.round.timer.canReveal).toBe(true);
    expect(ErrorEventSchema.parse(await command(round.players[1], 'answer.set', { roundId: round.roundId, answer })))
      .toMatchObject({ code: 'INPUT_CLOSED' });
    expect(ErrorEventSchema.parse(await command(round.projector, 'game.reveal', { roundId: round.roundId })))
      .toMatchObject({ code: 'FORBIDDEN' });
    expect((await command(round.host, 'game.reveal', { roundId: round.roundId })).type).toBe('ack');
    expect((await snapshot(round.host, value => value.phase === 'evaluation')).phase).toBe('evaluation');
  });

  it('closes input early after every frozen player submits but still waits for host reveal', async () => {
    const round = await beginRound('quiz');
    const answer = { kind: 'quiz', optionId: 'b' };
    for (const player of round.players) {
      expect((await command(player, 'answer.submit', { roundId: round.roundId, answer })).type).toBe('ack');
    }
    const closed = await snapshot(round.host, value => value.phase === 'playing'
      && value.round?.phase === 'playing' && value.round.timer.inputClosed);
    expect(closed.phase).toBe('playing');
    expect(closed.round?.phase === 'playing' && closed.round.timer.canReveal).toBe(true);
    expect((await command(round.host, 'game.reveal', { roundId: round.roundId })).type).toBe('ack');
    expect((await snapshot(round.host, value => value.phase === 'evaluation')).phase).toBe('evaluation');
  });

  it('freezes participants and restores the same player draft, final state, and deadline on reauth', async () => {
    const round = await beginRound('quiz');
    const initialPlaying = round.playing[2];
    if (initialPlaying.role !== 'player' || initialPlaying.round?.phase !== 'playing') {
      throw new Error('Expected an active player round.');
    }
    const initialDeadline = initialPlaying.round.timer.deadline;
    const draft = { kind: 'quiz', optionId: 'b' };
    expect((await command(round.players[0], 'answer.set', { roundId: round.roundId, answer: draft })).type).toBe('ack');

    const lateSession = await joinPlayer(round.server, round.lobby.lobbyId, 'Late player');
    const latePlayer = await connect(round.server, lateSession);
    const lateSnapshot = latePlayer.snapshot;
    expect(lateSnapshot.participants.find(participant => participant.name === 'Late player')?.waiting).toBe(true);
    if (lateSnapshot.role === 'player') expect(lateSnapshot.input.participating).toBe(false);

    await closeSocket(round.players[0].socket);
    const reconnectedDraft = await connect(round.server, round.playerSessions[0]);
    const draftSnapshot = reconnectedDraft.snapshot;
    if (draftSnapshot.role !== 'player' || draftSnapshot.round?.phase !== 'playing') throw new Error('Expected the restored player round.');
    const playerId = initialPlaying.playerId;
    expect(draftSnapshot.playerId).toBe(playerId);
    expect(draftSnapshot.input).toMatchObject({ answer: draft, final: false, participating: true });
    expect(draftSnapshot.round.timer.deadline).toBe(initialDeadline);
    expect(draftSnapshot.participants).toHaveLength(3);
    expect(draftSnapshot.participants.find(participant => participant.id === playerId)?.waiting).toBe(false);
    expect(draftSnapshot.participants.find(participant => participant.name === 'Late player')?.waiting).toBe(true);

    const finalAnswer = { kind: 'quiz', optionId: 'c' };
    expect((await command(reconnectedDraft, 'answer.submit', { roundId: round.roundId, answer: finalAnswer })).type).toBe('ack');
    await closeSocket(reconnectedDraft.socket);
    const reconnectedFinal = await connect(round.server, round.playerSessions[0]);
    const finalSnapshot = reconnectedFinal.snapshot;
    if (finalSnapshot.role !== 'player' || finalSnapshot.round?.phase !== 'playing') throw new Error('Expected the restored final player round.');
    expect(finalSnapshot.playerId).toBe(playerId);
    expect(finalSnapshot.input).toMatchObject({ answer: finalAnswer, final: true, participating: true });
    expect(finalSnapshot.round.timer.deadline).toBe(initialDeadline);
    expect(ErrorEventSchema.parse(await command(reconnectedFinal, 'answer.set', { roundId: round.roundId, answer: draft })))
      .toMatchObject({ code: 'INPUT_CLOSED' });
  });
});
