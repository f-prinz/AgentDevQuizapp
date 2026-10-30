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
  id: 'e2e_lobby_quiz',
  kind: 'quiz',
  title: 'E2E Quiz',

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

describe('e2e: lobby and reconnect flow', () => {
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

  it('runs host, projector and two players over real REST and WS connections through a complete round', async () => {
    const lobby = await createLobby();
    const ada = await joinPlayer(lobby.lobbyId, 'Ada');
    const bo = await joinPlayer(lobby.lobbyId, 'Bo');

    const host = await connect(lobby.host);
    const projector = await connect(lobby.projector);
    const playerAda = await connect(ada);
    const playerBo = await connect(bo);
    expect(host.snapshot.type).toBe('snapshot');
    expect(projector.snapshot.type).toBe('snapshot');
    if (host.snapshot.type !== 'snapshot' || playerAda.snapshot.type !== 'snapshot') throw new Error('Expected snapshots.');
    expect(host.snapshot.participants).toHaveLength(2);
    expect(host.snapshot.participants.map(p => p.name)).toEqual(['Ada', 'Bo']);

    // Host startet die Lobby -> Uebersicht.
    const overviewHost = host.inbox.waitFor(m => m.type === 'snapshot' && m.phase === 'overview');
    const overviewProjector = projector.inbox.waitFor(m => m.type === 'snapshot' && m.phase === 'overview');
    await send(host.socket, host.inbox, 'start_lobby', { type: 'lobby.start' });
    const hostOverview = await overviewHost;
    await overviewProjector;
    expect(hostOverview.type).toBe('snapshot');
    if (hostOverview.type !== 'snapshot') throw new Error('Expected overview snapshot.');
    expect(hostOverview.catalog.some(game => game.id === 'e2e_lobby_quiz')).toBe(true);

    // Host waehlt und bereitet das Quiz vor, startet die Runde.
    const hostStartPhase = host.inbox.waitFor(m => m.type === 'snapshot' && m.round?.phase === 'start');
    const ack1 = send(host.socket, host.inbox, 'select_game', { type: 'game.select', gameId: 'e2e_lobby_quiz' });
    expect((await ack1).type).toBe('ack');
    const ack2 = send(host.socket, host.inbox, 'prepare_game', { type: 'game.prepare' });
    expect((await ack2).type).toBe('ack');
    const startSnap = await hostStartPhase;
    if (startSnap.type !== 'snapshot' || startSnap.round?.phase !== 'start') throw new Error('Expected start phase.');
    const roundId = startSnap.round.roundId;

    const playingPlayer = playerAda.inbox.waitFor(m => m.type === 'snapshot' && m.round?.phase === 'playing');
    const playingProjector = projector.inbox.waitFor(m => m.type === 'snapshot' && m.round?.phase === 'playing');
    await send(host.socket, host.inbox, 'start_round', { type: 'game.start', roundId });
    const playing = await playingPlayer;
    await playingProjector;
    if (playing.type !== 'snapshot' || playing.round?.phase !== 'playing') throw new Error('Expected playing phase.');
    expect(playing.round.task.kind).toBe('quiz');

    // Spieler beantworten, Host loest auf.
    await send(playerAda.socket, playerAda.inbox, 'answer_ada', { type: 'answer.submit', roundId, answer: { kind: 'quiz', optionId: 'a' } });
    await send(playerBo.socket, playerBo.inbox, 'answer_bo', { type: 'answer.submit', roundId, answer: { kind: 'quiz', optionId: 'b' } });
    const evalHost = host.inbox.waitFor(m => m.type === 'snapshot' && m.round?.phase === 'evaluation');
    const evalAda = playerAda.inbox.waitFor(m => m.type === 'snapshot' && m.round?.phase === 'evaluation');
    await send(host.socket, host.inbox, 'reveal', { type: 'game.reveal', roundId });
    const evaluation = await evalHost;
    const adaEval = await evalAda;
    if (evaluation.type !== 'snapshot' || evaluation.role !== 'host' || evaluation.round?.phase !== 'evaluation') throw new Error('Expected evaluation.');
    // TECH-17: Erwartung aus der Spielart-Konfiguration ableiten statt hart.
    const quizPoints = GAME_CONFIG.quiz.scoring.pointsPerCorrectAnswer;
    expect(evaluation.round.results.find(result => result.name === 'Ada')?.points).toBe(quizPoints);
    expect(evaluation.round.results.find(result => result.name === 'Bo')?.points).toBe(0);
    if (adaEval.type !== 'snapshot' || adaEval.role !== 'player' || adaEval.round?.phase !== 'evaluation') throw new Error('Expected player evaluation.');
    expect(adaEval.round.ownEvaluation.points).toBe(quizPoints);

    // Spielende -> Uebersicht mit gespieltem Katalogeintrag und Ranking.
    // CHG-12: ranking.length > 0 ist seit dem Live-Ranking immer wahr —
    // auf den played-Status des Spiels warten.
    const backToOverview = projector.inbox.waitFor(m => m.type === 'snapshot' && m.phase === 'overview'
      && m.catalog.find(game => game.id === 'e2e_lobby_quiz')?.played === true);
    await send(host.socket, host.inbox, 'finish', { type: 'game.finish', roundId });
    const final = await backToOverview;
    if (final.type !== 'snapshot') throw new Error('Expected overview snapshot.');
    expect(final.catalog.find(game => game.id === 'e2e_lobby_quiz')?.played).toBe(true);
    expect(final.ranking.find(entry => entry.name === 'Ada')?.total).toBe(quizPoints);
    // BUG-6: Die Transition ist konsumiert — nach dem Beenden kein stale
    // rankingTransition mehr im Snapshot (sonst re-animiert die Tabelle bei
    // jeder weiteren Aktion).
    expect(final.rankingTransition).toBeNull();
  });

  it('rejects moderation commands from non-host roles', async () => {
    const lobby = await createLobby();
    const ada = await joinPlayer(lobby.lobbyId, 'Ada');
    const bo = await joinPlayer(lobby.lobbyId, 'Bo');
    const host = await connect(lobby.host);
    const player = await connect(ada);
    await connect(bo);

    const startError = send(player.socket, player.inbox, 'bad_start', { type: 'lobby.start' });
    const response = await startError;
    expect(response.type).toBe('error');
    if (response.type !== 'error') throw new Error('Expected an error event.');
    expect(['UNAUTHORIZED', 'FORBIDDEN']).toContain(response.code);

    const overview = host.inbox.waitFor(m => m.type === 'snapshot' && m.phase === 'overview');
    await send(host.socket, host.inbox, 'start_lobby', { type: 'lobby.start' });
    await overview;
    const selectError = send(player.socket, player.inbox, 'bad_select', { type: 'game.select', gameId: 'e2e_lobby_quiz' });
    const selectResponse = await selectError;
    expect(selectResponse.type).toBe('error');
    if (selectResponse.type !== 'error') throw new Error('Expected an error event.');
    expect(['UNAUTHORIZED', 'FORBIDDEN']).toContain(selectResponse.code);
  });

  it('restores a session after a reconnect without duplicating the participant', async () => {
    const lobby = await createLobby();
    const ada = await joinPlayer(lobby.lobbyId, 'Ada');
    const host = await connect(lobby.host);
    const first = await connect(ada);
    expect(first.snapshot.type).toBe('snapshot');
    if (first.snapshot.type !== 'snapshot') throw new Error('Expected snapshot.');
    const playerId = first.snapshot.role === 'player' ? first.snapshot.playerId : null;
    expect(playerId).not.toBeNull();

    // Simulierter Refresh: alte Verbindung zu, neue Verbindung mit derselben Sitzung.
    first.socket.terminate();
    const second = await connect(ada);
    expect(second.snapshot.type).toBe('snapshot');
    if (second.snapshot.type !== 'snapshot' || host.snapshot.type !== 'snapshot') throw new Error('Expected snapshots.');
    expect(second.snapshot.role === 'player' ? second.snapshot.playerId : null).toBe(playerId);
    const hostUpdate = host.inbox.waitFor(m => m.type === 'snapshot' && m.participants.every(p => p.connected));
    const updated = await hostUpdate;
    if (updated.type !== 'snapshot') throw new Error('Expected snapshot.');
    expect(updated.participants).toHaveLength(1);
  });

  it('marks a player who joins during a running round as waiting', async () => {
    const lobby = await createLobby();
    await joinPlayer(lobby.lobbyId, 'Ada');
    await joinPlayer(lobby.lobbyId, 'Bo');
    const host = await connect(lobby.host);

    const hostStart = host.inbox.waitFor(m => m.type === 'snapshot' && m.round?.phase === 'start');
    await send(host.socket, host.inbox, 'start_lobby', { type: 'lobby.start' });
    await send(host.socket, host.inbox, 'select_game', { type: 'game.select', gameId: 'e2e_lobby_quiz' });
    await send(host.socket, host.inbox, 'prepare_game', { type: 'game.prepare' });
    const startSnap = await hostStart;
    if (startSnap.type !== 'snapshot' || startSnap.round?.phase !== 'start') throw new Error('Expected start phase.');
    const roundId = startSnap.round.roundId;
    const playing = host.inbox.waitFor(m => m.type === 'snapshot' && m.round?.phase === 'playing');
    await send(host.socket, host.inbox, 'start_round', { type: 'game.start', roundId });
    await playing;

    // Spaeter Beitritt waehrend der laufenden Runde.
    const lateJoin = await joinPlayer(lobby.lobbyId, 'Cyd');
    const late = await connect(lateJoin);
    expect(late.snapshot.type).toBe('snapshot');
    if (late.snapshot.type !== 'snapshot' || late.snapshot.role !== 'player') throw new Error('Expected player snapshot.');
    expect(late.snapshot.input.participating).toBe(false);
    const waitingEntry = late.snapshot.participants.find(participant => participant.name === 'Cyd');
    expect(waitingEntry?.waiting).toBe(true);
  });
});
