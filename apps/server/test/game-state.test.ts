import { afterEach, describe, expect, it, vi } from 'vitest';
import WebSocket from 'ws';
import {
  CreateLobbyResponseSchema,
  ErrorEventSchema,
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
    id: 'quiz_game', kind: 'quiz', title: 'Quiz', rules: 'Answer the question.',
    questions: [{
      id: 'quiz_q1', question: 'Which option is correct?',
      options: [
        { id: 'a', text: 'A' }, { id: 'b', text: 'B' },
        { id: 'c', text: 'C' }, { id: 'd', text: 'D' },
      ],
      correctOptionId: 'c',
    }],
  }),
  GameSeedSchema.parse({
    id: 'sorting_game', kind: 'sorting', title: 'Sort', rules: 'Order the terms.',
    question: 'Order these terms.',
    terms: [{ id: 'term_a', text: 'First', value: 1 }, { id: 'term_b', text: 'Second', value: 2 }],
  }),
  GameSeedSchema.parse({
    id: 'estimate_game', kind: 'estimation', title: 'Estimate', rules: 'Estimate the value.',
    question: 'How many?', target: 42,
  }),
];
const multiQuestionQuiz = GameSeedSchema.parse({
  id: 'quiz_game', kind: 'quiz', title: 'Quiz', rules: 'Answer the question.',
  questions: [
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
    expect(firstEvaluation.round.results.map(result => result.points)).toEqual([1, 0]);
    const firstPlayerEvaluation = await snapshot(round.players[0], value => value.phase === 'evaluation'
      && value.round?.roundId === round.roundId);
    if (firstPlayerEvaluation.role !== 'player' || firstPlayerEvaluation.round?.phase !== 'evaluation') {
      throw new Error('Expected the first player quiz evaluation.');
    }
    expect(firstPlayerEvaluation.round.ownEvaluation).toMatchObject({
      answer: { kind: 'quiz', optionId: 'c' }, points: 1,
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
    expect(lastEvaluation.round.results.map(result => result.points)).toEqual([0, 1]);
    expect(ErrorEventSchema.parse(await command(round.host, 'game.next', { roundId: secondRoundId })))
      .toMatchObject({ code: 'INVALID_PHASE' });
    expect((await command(round.host, 'game.finish', { roundId: secondRoundId })).type).toBe('ack');
    expect(await snapshot(round.host, value => value.phase === 'overview')).toMatchObject({
      phase: 'overview', round: null,
    });
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
