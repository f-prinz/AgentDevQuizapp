import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import {
  CreateLobbyResponseSchema,
  GameSeedSchema,
  JoinPlayerResponseSchema,
  ServerMessageSchema,
  type ServerMessage,
} from '@raccoons/contracts';
import { buildServer } from '../../src/app.ts';

const config = { host: '127.0.0.1', port: 0 };
const estimationSeed = GameSeedSchema.parse({
  id: 'e2e_estimate_game',
  kind: 'estimation',
  title: 'E2E Schaetzen',

  question: 'Wie hoch ist der Eiffelturm in Metern?',
  target: 330,
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

describe('e2e: estimation round flow', () => {
  beforeEach(async () => {
    app = buildServer(config);
    app.decorate('catalog', [estimationSeed]);
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

  it('scores estimates by distance and shows the solution to every role', async () => {
    const lobby = await createLobby();
    const ada = await connect(await joinPlayer(lobby.lobbyId, 'Ada'));
    const bo = await connect(await joinPlayer(lobby.lobbyId, 'Bo'));
    const host = await connect(lobby.host);
    const projector = await connect(lobby.projector);

    const hostStart = host.inbox.waitFor(m => m.type === 'snapshot' && m.round?.phase === 'start');
    await send(host.socket, host.inbox, 'start', { type: 'lobby.start' });
    await send(host.socket, host.inbox, 'select', { type: 'game.select', gameId: 'e2e_estimate_game' });
    await send(host.socket, host.inbox, 'prepare', { type: 'game.prepare' });
    const startSnap = await hostStart;
    if (startSnap.type !== 'snapshot' || startSnap.round?.phase !== 'start') throw new Error('Expected start phase.');
    const roundId = startSnap.round.roundId;

    const playAda = ada.inbox.waitFor(m => m.type === 'snapshot' && m.round?.roundId === roundId && m.round?.phase === 'playing');
    const playProj = projector.inbox.waitFor(m => m.type === 'snapshot' && m.round?.roundId === roundId && m.round?.phase === 'playing');
    await send(host.socket, host.inbox, 'play', { type: 'game.start', roundId });
    const adaPlaying = await playAda;
    const projPlaying = await playProj;
    if (adaPlaying.type !== 'snapshot' || adaPlaying.round?.phase !== 'playing') throw new Error('Expected playing.');
    expect(adaPlaying.round.task).toMatchObject({ kind: 'estimation', question: 'Wie hoch ist der Eiffelturm in Metern?' });
    // Loesung bleibt vor der Aufloesung geheim.
    expect(adaPlaying.round.task).not.toHaveProperty('target');
    if (projPlaying.type !== 'snapshot' || projPlaying.round?.phase !== 'playing') throw new Error('Expected projector playing.');
    expect(projPlaying.round.task).not.toHaveProperty('target');

    // Zwei Schaetzungen mit unterschiedlichem Abstand.
    await send(ada.socket, ada.inbox, 'ada_set', { type: 'answer.set', roundId, answer: { kind: 'estimation', value: 320 } });
    await send(ada.socket, ada.inbox, 'ada_submit', { type: 'answer.submit', roundId, answer: { kind: 'estimation', value: 320 } });
    await send(bo.socket, bo.inbox, 'bo_submit', { type: 'answer.submit', roundId, answer: { kind: 'estimation', value: 250 } });

    const closedSnap = await host.inbox.waitFor(
      m => m.type === 'snapshot' && m.round?.roundId === roundId && m.round?.phase === 'playing' && m.round.timer.inputClosed,
    );
    expect(closedSnap.type).toBe('snapshot');

    const evalHost = host.inbox.waitFor(m => m.type === 'snapshot' && m.round?.roundId === roundId && m.round?.phase === 'evaluation');
    const evalAda = ada.inbox.waitFor(m => m.type === 'snapshot' && m.round?.roundId === roundId && m.round?.phase === 'evaluation');
    const evalProj = projector.inbox.waitFor(m => m.type === 'snapshot' && m.round?.roundId === roundId && m.round?.phase === 'evaluation');
    await send(host.socket, host.inbox, 'reveal', { type: 'game.reveal', roundId });
    const evaluation = await evalHost;
    if (evaluation.type !== 'snapshot' || evaluation.role !== 'host' || evaluation.round?.phase !== 'evaluation') throw new Error('Expected evaluation.');
    expect(evaluation.round.solution.kind).toBe('estimation');
    if (evaluation.round.solution.kind !== 'estimation') throw new Error('Expected estimation solution.');
    expect(evaluation.round.solution.target).toBe(330);
    const adaResult = evaluation.round.results.find(result => result.name === 'Ada');
    const boResult = evaluation.round.results.find(result => result.name === 'Bo');
    expect(adaResult?.distance).toBe(10);
    expect(boResult?.distance).toBe(80);
    expect(adaResult?.rank).toBe(1);
    expect((adaResult?.points ?? 0)).toBeGreaterThan(boResult?.points ?? 0);

    const adaEval = await evalAda;
    if (adaEval.type !== 'snapshot' || adaEval.role !== 'player' || adaEval.round?.phase !== 'evaluation') throw new Error('Expected player evaluation.');
    expect(adaEval.round.ownEvaluation.answer).toMatchObject({ kind: 'estimation', value: 320 });
    expect(adaEval.round.ownEvaluation.distance).toBe(10);
    const projEval = await evalProj;
    if (projEval.type !== 'snapshot' || projEval.role !== 'projector' || projEval.round?.phase !== 'evaluation') throw new Error('Expected projector evaluation.');
    expect(projEval.round.solution.kind).toBe('estimation');
    expect(projEval.round.results.find(result => result.name === 'Ada')?.distance).toBe(10);

    // CHG-12: ranking.length > 0 ist seit dem Live-Ranking immer wahr —
    // auf den played-Status des Spiels warten.
    const backToOverview = projector.inbox.waitFor(m => m.type === 'snapshot' && m.phase === 'overview'
      && m.catalog.find(game => game.id === 'e2e_estimate_game')?.played === true);
    await send(host.socket, host.inbox, 'finish', { type: 'game.finish', roundId });
    const final = await backToOverview;
    if (final.type !== 'snapshot') throw new Error('Expected overview snapshot.');
    expect(final.catalog.find(game => game.id === 'e2e_estimate_game')?.played).toBe(true);
    expect(final.ranking.find(entry => entry.name === 'Ada')?.total).toBeGreaterThan(0);
  });
});
