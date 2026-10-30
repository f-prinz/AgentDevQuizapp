import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import {
  CreateLobbyResponseSchema,
  GAME_CONFIG,
  GameSeedSchema,
  JoinPlayerResponseSchema,
  ServerMessageSchema,
  type ServerMessage,
} from '@raccoons/contracts';
import { buildServer } from '../../src/app.ts';

const config = { host: '127.0.0.1', port: 0 };
const quizSeed = GameSeedSchema.parse({
  id: 'e2e_quiz_game',
  kind: 'quiz',
  title: 'E2E Zwei Fragen',

  questions: [
    {
      id: 'q1', question: 'Erste Frage?',
      options: [{ id: 'a', text: 'A1' }, { id: 'b', text: 'B1' }, { id: 'c', text: 'C1' }, { id: 'd', text: 'D1' }],
      correctOptionId: 'a',
    },
    {
      id: 'q2', question: 'Zweite Frage?',
      options: [{ id: 'a', text: 'A2' }, { id: 'b', text: 'B2' }, { id: 'c', text: 'C2' }, { id: 'd', text: 'D2' }],
      correctOptionId: 'c',
    },
  ],
});

type Predicate = (message: ServerMessage) => boolean;
interface Inbox { waitFor(predicate: Predicate, timeoutMs?: number): Promise<ServerMessage>; }

function createInbox(socket: WebSocket): Inbox {
  const messages: ServerMessage[] = [];
  const waiters: Array<{ predicate: Predicate; resolve: (m: ServerMessage) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }> = [];
  let parseError: Error | undefined;
  socket.on('message', (raw) => {
    try {
      const message = ServerMessageSchema.parse(JSON.parse(raw.toString()) as unknown);
      const index = waiters.findIndex(waiter => waiter.predicate(message));
      if (index < 0) { messages.push(message); return; }
      const [waiter] = waiters.splice(index, 1);
      if (waiter) { clearTimeout(waiter.timer); waiter.resolve(message); }
    } catch {
      parseError = new Error('Invalid server message.');
      for (const waiter of waiters.splice(0)) { clearTimeout(waiter.timer); waiter.reject(parseError); }
    }
  });
  return {
    waitFor(predicate, timeoutMs = 3_000) {
      if (parseError) return Promise.reject(parseError);
      const index = messages.findIndex(predicate);
      if (index >= 0) { const [message] = messages.splice(index, 1); if (message) return Promise.resolve(message); }
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timed out waiting for a WebSocket message.')), timeoutMs);
        waiters.push({ predicate, resolve, reject, timer });
      });
    },
  };
}

let app: ReturnType<typeof buildServer>;
let baseUrl: string;
let wsUrl: string;
let clients: WebSocket[];

async function openSocket(): Promise<WebSocket> {
  const socket = new WebSocket(`${wsUrl}/ws`, { origin: 'http://127.0.0.1:5173' });
  clients.push(socket);
  await new Promise<void>((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
  return socket;
}
async function createLobby() {
  const response = await fetch(`${baseUrl}/lobbies`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  expect(response.ok).toBe(true);
  return CreateLobbyResponseSchema.parse(await response.json());
}
async function joinPlayer(lobbyId: string, name: string) {
  const response = await fetch(`${baseUrl}/lobbies/${lobbyId}/players`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }),
  });
  expect(response.ok).toBe(true);
  return JoinPlayerResponseSchema.parse(await response.json()).session;
}
interface Session { lobbyId: string; sessionId: string; role: 'host' | 'player' | 'projector'; token: string; }
async function connect(session: Session) {
  const socket = await openSocket();
  const inbox = createInbox(socket);
  const requestId = `auth_${session.sessionId}`;
  const ack = inbox.waitFor(m => m.type === 'ack' && m.requestId === requestId);
  const snapshot = inbox.waitFor(m => m.type === 'snapshot' && m.role === session.role);
  socket.send(JSON.stringify({ version: 1, type: 'auth', requestId, lobbyId: session.lobbyId, sessionId: session.sessionId, token: session.token }));
  await ack;
  return { socket, inbox, snapshot: await snapshot };
}
async function send(socket: WebSocket, inbox: Inbox, requestId: string, message: Record<string, unknown>) {
  const response = inbox.waitFor(m => (m.type === 'ack' || m.type === 'error') && m.requestId === requestId);
  socket.send(JSON.stringify({ version: 1, requestId, ...message }));
  return response;
}

describe('e2e: quiz round flow', () => {
  beforeEach(async () => {
    app = buildServer(config);
    app.decorate('catalog', [quizSeed]);
    await app.listen(config);
    const address = app.server.address();
    if (!address || typeof address === 'string') throw new Error('Expected a TCP listener.');
    baseUrl = `http://127.0.0.1:${address.port}`;
    wsUrl = `ws://127.0.0.1:${address.port}`;
    clients = [];
  });
  afterEach(async () => {
    for (const client of clients) client.terminate();
    await app.close();
  });

  it('scores a two-question quiz for two players with correct, wrong and missing answers', async () => {
    const lobby = await createLobby();
    const ada = await connect(await joinPlayer(lobby.lobbyId, 'Ada'));
    const bo = await connect(await joinPlayer(lobby.lobbyId, 'Bo'));
    const host = await connect(lobby.host);
    const projector = await connect(lobby.projector);

    const hostStart = host.inbox.waitFor(m => m.type === 'snapshot' && m.round?.phase === 'start');
    await send(host.socket, host.inbox, 'start', { type: 'lobby.start' });
    await send(host.socket, host.inbox, 'select', { type: 'game.select', gameId: 'e2e_quiz_game' });
    await send(host.socket, host.inbox, 'prepare', { type: 'game.prepare' });
    const startSnap = await hostStart;
    if (startSnap.type !== 'snapshot' || startSnap.round?.phase !== 'start') throw new Error('Expected start phase.');
    expect(startSnap.round.questionCount).toBe(2);
    const roundId = startSnap.round.roundId;

    // Frage 1: Ada richtig, Bo falsch.
    const play1Host = host.inbox.waitFor(m => m.type === 'snapshot' && m.round?.phase === 'playing' && m.round.questionIndex === 0);
    const play1Proj = projector.inbox.waitFor(m => m.type === 'snapshot' && m.round?.phase === 'playing' && m.round.questionIndex === 0);
    await send(host.socket, host.inbox, 'play1', { type: 'game.start', roundId });
    const hostPlaying = await play1Host;
    const projPlaying = await play1Proj;
    if (hostPlaying.type !== 'snapshot' || hostPlaying.role !== 'host' || hostPlaying.round?.phase !== 'playing') throw new Error('Expected host playing.');
    expect(hostPlaying.round.task.kind).toBe('quiz');
    if (hostPlaying.round.task.kind !== 'quiz') throw new Error('Expected quiz task.');
    expect(hostPlaying.round.task.options).toHaveLength(4);
    if (projPlaying.type !== 'snapshot' || projPlaying.role !== 'projector' || projPlaying.round?.phase !== 'playing') throw new Error('Expected projector playing.');
    expect(projPlaying.round.task).not.toHaveProperty('options');

    await send(ada.socket, ada.inbox, 'a1', { type: 'answer.submit', roundId, answer: { kind: 'quiz', optionId: 'a' } });
    await send(bo.socket, bo.inbox, 'b1', { type: 'answer.submit', roundId, answer: { kind: 'quiz', optionId: 'd' } });
    const eval1 = host.inbox.waitFor(m => m.type === 'snapshot' && m.round?.phase === 'evaluation');
    const eval1Ada = ada.inbox.waitFor(m => m.type === 'snapshot' && m.round?.phase === 'evaluation');
    await send(host.socket, host.inbox, 'reveal1', { type: 'game.reveal', roundId });
    const evaluation1 = await eval1;
    if (evaluation1.type !== 'snapshot' || evaluation1.role !== 'host' || evaluation1.round?.phase !== 'evaluation') throw new Error('Expected evaluation.');
    expect(evaluation1.round.solution.kind).toBe('quiz');
    if (evaluation1.round.solution.kind !== 'quiz') throw new Error('Expected quiz solution.');
    expect(evaluation1.round.solution.correctOptionId).toBe('a');
    // TECH-17: Erwartung aus der Spielart-Konfiguration ableiten statt hart.
    const quizPoints = GAME_CONFIG.quiz.scoring.pointsPerCorrectAnswer;
    expect(evaluation1.round.results.find(r => r.name === 'Ada')?.points).toBe(quizPoints);
    expect(evaluation1.round.results.find(r => r.name === 'Bo')?.points).toBe(0);
    const adaEval1 = await eval1Ada;
    if (adaEval1.type !== 'snapshot' || adaEval1.role !== 'player' || adaEval1.round?.phase !== 'evaluation') throw new Error('Expected player evaluation.');
    expect(adaEval1.round.ownEvaluation.points).toBe(quizPoints);
    expect(adaEval1.round.ownEvaluation.answer).toMatchObject({ kind: 'quiz', optionId: 'a' });

    // Frage 2: niemand antwortet — Aufloesung ist bis zum Eingabeende gesperrt.
    const play2 = host.inbox.waitFor(m => m.type === 'snapshot' && m.round?.phase === 'playing' && m.round.questionIndex === 1);
    await send(host.socket, host.inbox, 'next', { type: 'game.next', roundId });
    const secondQuestion = await play2;
    if (secondQuestion.type !== 'snapshot' || secondQuestion.role !== 'host' || secondQuestion.round?.phase !== 'playing') throw new Error('Expected second question.');
    expect(secondQuestion.round.questionIndex).toBe(1);
    // BUG-6: Die Transition der ersten Aufloesung ist konsumiert — beim
    // Start der naechsten Frage darf kein stale rankingTransition mehr
    // mitgeliefert werden.
    expect(secondQuestion.rankingTransition).toBeNull();
    expect(secondQuestion.round.task.kind).toBe('quiz');
    if (secondQuestion.round.task.kind !== 'quiz') throw new Error('Expected quiz task.');
    expect(secondQuestion.round.task.question).toContain('Zweite Frage');
    const roundId2 = secondQuestion.round.roundId;
    expect(roundId2).not.toBe(roundId);

    // Host kann nicht vor dem Eingabeende aufloesen.
    const earlyReveal = await send(host.socket, host.inbox, 'early_reveal', { type: 'game.reveal', roundId: roundId2 });
    expect(earlyReveal.type).toBe('error');
    if (earlyReveal.type !== 'error') throw new Error('Expected an error event.');
    expect(earlyReveal.code).toBe('INVALID_PHASE');

    // Echte Deadline abwarten: Server schliesst die Eingabe.
    const inputClosedSnap = await host.inbox.waitFor(
      m => m.type === 'snapshot' && m.role === 'host' && m.round?.roundId === roundId2
        && m.round?.phase === 'playing' && m.round.timer.inputClosed,
      40_000,
    );
    expect(inputClosedSnap.type).toBe('snapshot');

    // Spaete Abgabe nach der Deadline wird abgewiesen.
    const lateResponse = await send(ada.socket, ada.inbox, 'late', { type: 'answer.submit', roundId: roundId2, answer: { kind: 'quiz', optionId: 'c' } });
    expect(lateResponse.type).toBe('error');
    if (lateResponse.type !== 'error') throw new Error('Expected an error event.');
    expect(['INPUT_CLOSED', 'INVALID_PHASE']).toContain(lateResponse.code);

    // Aufloesung ohne Antworten: beide 0 Punkte, keine eigene Antwort.
    const eval2 = host.inbox.waitFor(m => m.type === 'snapshot' && m.round?.roundId === roundId2 && m.round?.phase === 'evaluation');
    const eval2Ada = ada.inbox.waitFor(m => m.type === 'snapshot' && m.round?.roundId === roundId2 && m.round?.phase === 'evaluation');
    await send(host.socket, host.inbox, 'reveal2', { type: 'game.reveal', roundId: roundId2 });
    const evaluation2 = await eval2;
    if (evaluation2.type !== 'snapshot' || evaluation2.role !== 'host' || evaluation2.round?.phase !== 'evaluation') throw new Error('Expected evaluation 2.');
    expect(evaluation2.round.results.every(r => r.points === 0)).toBe(true);
    expect(evaluation2.round.hasNextQuestion).toBe(false);
    const adaEval2 = await eval2Ada;
    if (adaEval2.type !== 'snapshot' || adaEval2.role !== 'player' || adaEval2.round?.phase !== 'evaluation') throw new Error('Expected player evaluation 2.');
    expect(adaEval2.round.ownEvaluation.answer).toBeNull();
  }, 50_000);
});
