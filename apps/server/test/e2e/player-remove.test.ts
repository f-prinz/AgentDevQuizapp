// FEAT-18: Host kann Spieler entfernen — vollstaendiges Entfernen aus Lobby,
// laufender Runde und Ranking; Session wird invalidiert und der Socket
// geschlossen. Zusaetzlich zeigt der Host-Snapshot den Abgabestatus
// (participants[].submitted).
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
const quizSeed = GameSeedSchema.parse({
  id: 'e2e_kick_quiz',
  kind: 'quiz',
  title: 'E2E Kick Quiz',

  questions: [{
    id: 'q1',
    question: 'Testfrage?',
    options: [
      { id: 'a', text: 'A' }, { id: 'b', text: 'B' }, { id: 'c', text: 'C' }, { id: 'd', text: 'D' },
    ],
    correctOptionId: 'a',
  }],
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

async function joinPlayer(lobbyId: string, name?: string) {
  const response = await fetch(`${baseUrl}/lobbies/${lobbyId}/players`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(name ? { name } : {}),
  });
  expect(response.ok).toBe(true);
  return JoinPlayerResponseSchema.parse(await response.json()).session;
}

interface Session { lobbyId: string; sessionId: string; role: 'host' | 'player' | 'projector'; token: string; }

async function connect(session: Session) {
  const socket = await openSocket();
  const inbox = createInbox(socket);
  const requestId = `auth_${session.sessionId}`;
  const ack = inbox.waitFor(message => message.type === 'ack' && message.requestId === requestId);
  const snapshot = inbox.waitFor(message => message.type === 'snapshot' && message.role === session.role);
  socket.send(JSON.stringify({ version: 1, type: 'auth', requestId, lobbyId: session.lobbyId, sessionId: session.sessionId, token: session.token }));
  await ack;
  return { socket, inbox, snapshot: await snapshot };
}

async function send(socket: WebSocket, inbox: Inbox, requestId: string, message: Record<string, unknown>) {
  const response = inbox.waitFor(m => (m.type === 'ack' || m.type === 'error') && m.requestId === requestId);
  socket.send(JSON.stringify({ version: 1, requestId, ...message }));
  return response;
}

const playerIdOf = (snapshot: ServerMessage): string | undefined =>
  snapshot.type === 'snapshot' && snapshot.role === 'player' ? snapshot.playerId : undefined;

describe('e2e: host removes players', () => {
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

  it('lets only the host remove a player and reports PLAYER_NOT_FOUND for unknown ids', async () => {
    const lobby = await createLobby();
    const ada = await joinPlayer(lobby.lobbyId, 'Ada');
    const bo = await joinPlayer(lobby.lobbyId, 'Bo');
    const host = await connect(lobby.host);
    const playerAda = await connect(ada);
    const playerBo = await connect(bo);
    const adaId = playerIdOf(playerAda.snapshot);
    const boId = playerIdOf(playerBo.snapshot);
    expect(adaId).toBeTruthy();
    expect(boId).toBeTruthy();

    const forbidden = await send(playerAda.socket, playerAda.inbox, 'forbid', { type: 'player.remove', playerId: boId });
    expect(forbidden.type).toBe('error');
    if (forbidden.type !== 'error') throw new Error('Expected error.');
    expect(forbidden.code).toBe('FORBIDDEN');

    const missing = await send(host.socket, host.inbox, 'missing', { type: 'player.remove', playerId: 'no_such_player' });
    expect(missing.type).toBe('error');
    if (missing.type !== 'error') throw new Error('Expected error.');
    expect(missing.code).toBe('PLAYER_NOT_FOUND');
  });

  it('removes a player completely, closes their socket and updates all snapshots', async () => {
    const lobby = await createLobby();
    const ada = await joinPlayer(lobby.lobbyId, 'Ada');
    const bo = await joinPlayer(lobby.lobbyId, 'Bo');
    const host = await connect(lobby.host);
    const projector = await connect(lobby.projector);
    const playerAda = await connect(ada);
    await connect(bo);
    const adaId = playerIdOf(playerAda.snapshot);
    expect(adaId).toBeTruthy();

    const gone = (m: ServerMessage) => m.type === 'snapshot' && m.participants.length === 1
      && m.participants.every(p => p.id !== adaId && p.name === 'Bo');
    const hostUpdate = host.inbox.waitFor(gone);
    const projectorUpdate = projector.inbox.waitFor(gone);
    const kicked = new Promise<void>((resolve, reject) => {
      playerAda.socket.once('close', () => resolve());
      setTimeout(() => reject(new Error('Kicked socket was not closed.')), 3_000);
    });

    const ack = await send(host.socket, host.inbox, 'kick', { type: 'player.remove', playerId: adaId });
    expect(ack.type).toBe('ack');
    await kicked;
    const hostSnap = await hostUpdate;
    const projectorSnap = await projectorUpdate;
    if (hostSnap.type !== 'snapshot' || projectorSnap.type !== 'snapshot') throw new Error('Expected snapshots.');
    expect(hostSnap.participants.map(p => p.name)).toEqual(['Bo']);
    expect(projectorSnap.participants.map(p => p.name)).toEqual(['Bo']);

    // Die Session ist invalidiert: ein erneuter Auth-Versuch schlaegt fehl.
    const retry = new WebSocket(`${wsUrl}/ws`, { origin: 'http://127.0.0.1:5173' });
    clients.push(retry);
    await new Promise<void>((resolve, reject) => { retry.once('open', resolve); retry.once('error', reject); });
    const denied = createInbox(retry).waitFor(m => m.type === 'error');
    const closedRetry = new Promise<void>(resolve => retry.once('close', () => resolve()));
    retry.send(JSON.stringify({ version: 1, type: 'auth', requestId: 'reauth', lobbyId: lobby.lobbyId, sessionId: ada.sessionId, token: ada.token }));
    const error = await denied;
    if (error.type !== 'error') throw new Error('Expected auth error.');
    expect(error.code).toBe('UNAUTHORIZED');
    await closedRetry;
  });

  it('marks submitted players and drops kicked players from ranking and results', async () => {
    const lobby = await createLobby();
    const ada = await joinPlayer(lobby.lobbyId, 'Ada');
    const bo = await joinPlayer(lobby.lobbyId, 'Bo');
    const host = await connect(lobby.host);
    const playerAda = await connect(ada);
    const playerBo = await connect(bo);
    const adaId = playerIdOf(playerAda.snapshot);
    expect(adaId).toBeTruthy();

    // Spiel starten.
    const hostStart = host.inbox.waitFor(m => m.type === 'snapshot' && m.round?.phase === 'start');
    await send(host.socket, host.inbox, 'start_lobby', { type: 'lobby.start' });
    await send(host.socket, host.inbox, 'select_game', { type: 'game.select', gameId: 'e2e_kick_quiz' });
    await send(host.socket, host.inbox, 'prepare_game', { type: 'game.prepare' });
    const startSnap = await hostStart;
    if (startSnap.type !== 'snapshot' || startSnap.round?.phase !== 'start') throw new Error('Expected start phase.');
    const roundId = startSnap.round.roundId;
    const playingHost = host.inbox.waitFor(m => m.type === 'snapshot' && m.round?.phase === 'playing');
    await send(host.socket, host.inbox, 'start_round', { type: 'game.start', roundId });
    await playingHost;

    // Abgabestatus: Ada submitted final, Bo nicht.
    const submittedSeen = host.inbox.waitFor(m => m.type === 'snapshot'
      && m.participants.find(p => p.id === adaId)?.submitted === true
      && m.participants.some(p => p.submitted !== true));
    await send(playerAda.socket, playerAda.inbox, 'answer_ada', { type: 'answer.submit', roundId, answer: { kind: 'quiz', optionId: 'a' } });
    const submittedSnap = await submittedSeen;
    if (submittedSnap.type !== 'snapshot') throw new Error('Expected snapshot.');
    expect(submittedSnap.participants.find(p => p.id === adaId)?.submitted).toBe(true);

    // Kick mitten in der laufenden Runde; Bo beendet danach noch normal.
    const gone = host.inbox.waitFor(m => m.type === 'snapshot' && m.participants.every(p => p.id !== adaId));
    await send(host.socket, host.inbox, 'kick_ada', { type: 'player.remove', playerId: adaId });
    await gone;
    await send(playerBo.socket, playerBo.inbox, 'answer_bo', { type: 'answer.submit', roundId, answer: { kind: 'quiz', optionId: 'b' } });

    const evalHost = host.inbox.waitFor(m => m.type === 'snapshot' && m.round?.phase === 'evaluation');
    await send(host.socket, host.inbox, 'reveal', { type: 'game.reveal', roundId });
    const evaluation = await evalHost;
    if (evaluation.type !== 'snapshot' || evaluation.role !== 'host' || evaluation.round?.phase !== 'evaluation') throw new Error('Expected evaluation.');
    // Entfernte Spieler tauchen nicht in der Aufloesung auf.
    expect(evaluation.round.results.every(result => result.playerId !== adaId)).toBe(true);

    // Wie CHG-12 im Lobby-Test: auf den played-Status warten — vor dem Spiel
    // gab es bereits Overview-Snapshots, die sonst stale matchen wuerden.
    const overview = host.inbox.waitFor(m => m.type === 'snapshot' && m.phase === 'overview'
      && m.catalog.find(game => game.id === 'e2e_kick_quiz')?.played === true);
    await send(host.socket, host.inbox, 'finish', { type: 'game.finish', roundId });
    const final = await overview;
    if (final.type !== 'snapshot') throw new Error('Expected overview snapshot.');
    // Ranking ohne den entfernten Spieler (auch nicht mit historischen Punkten).
    expect(final.ranking.every(entry => entry.playerId !== adaId)).toBe(true);
    // Bo hat falsch geantwortet und bleibt ohne Punkte im Ranking.
    expect(final.ranking.find(entry => entry.name === 'Bo')?.total).toBe(0);
  });
});
