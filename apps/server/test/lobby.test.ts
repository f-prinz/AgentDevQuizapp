import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import {
  CreateLobbyResponseSchema,
  ErrorEventSchema,
  GameSeedSchema,
  JoinPlayerResponseSchema,
  ServerMessageSchema,
  SnapshotSchema,
  type ServerMessage,
} from '@raccoons/contracts';
import { buildServer } from '../src/app.ts';

const config = { host: '127.0.0.1', port: 0 };
const privateCatalogGame = GameSeedSchema.parse({
  id: 'lobby_private_quiz',
  kind: 'quiz',
  title: 'Public quiz title',

  questions: [{
    id: 'question_1',
    question: 'PRIVATE_QUESTION_TEXT',
    options: [
      { id: 'option_a', text: 'Choice A' },
      { id: 'option_b', text: 'Choice B' },
      { id: 'option_c', text: 'Choice C' },
      { id: 'option_d', text: 'Choice D' },
    ],
    correctOptionId: 'option_c',
  }],
});

type MessagePredicate = (message: ServerMessage) => boolean;

interface MessageInbox {
  waitFor(predicate: MessagePredicate, timeoutMs?: number): Promise<ServerMessage>;
}

function createInbox(socket: WebSocket): MessageInbox {
  const messages: ServerMessage[] = [];
  const waiters: Array<{
    predicate: MessagePredicate;
    resolve: (message: ServerMessage) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }> = [];
  let parseError: Error | undefined;

  socket.on('message', (raw) => {
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
      const messageIndex = messages.findIndex(predicate);
      if (messageIndex >= 0) {
        const [message] = messages.splice(messageIndex, 1);
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

let app: ReturnType<typeof buildServer>;
let baseUrl: string;
let wsUrl: string;
let clients: WebSocket[];

async function openSocket(origin = 'http://127.0.0.1:5173'): Promise<WebSocket> {
  const socket = new WebSocket(`${wsUrl}/ws`, { origin });
  clients.push(socket);
  await new Promise<void>((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });
  return socket;
}

async function createLobby() {
  const response = await fetch(`${baseUrl}/lobbies`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  expect(response.status).toBeGreaterThanOrEqual(200);
  expect(response.status).toBeLessThan(300);
  return CreateLobbyResponseSchema.parse(await response.json());
}

async function joinPlayer(lobbyId: string, body: { name?: string } = {}) {
  const response = await fetch(`${baseUrl}/lobbies/${lobbyId}/players`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { response, session: response.ok ? JoinPlayerResponseSchema.parse(await response.json()).session : undefined };
}

async function connectAndAuthenticate(session: {
  lobbyId: string;
  sessionId: string;
  role: 'host' | 'player' | 'projector';
  token: string;
}) {
  const socket = await openSocket();
  const inbox = createInbox(socket);

  const requestId = `auth_${session.role}_${session.sessionId}`;
  const ack = inbox.waitFor(message => message.type === 'ack' && message.requestId === requestId);
  const snapshot = inbox.waitFor(message => message.type === 'snapshot' && message.role === session.role);
  socket.send(JSON.stringify({
    version: 1,
    type: 'auth',
    requestId,
    lobbyId: session.lobbyId,
    sessionId: session.sessionId,
    token: session.token,
  }));

  await ack;
  const message = await snapshot;
  return { socket, inbox, snapshot: SnapshotSchema.parse(message) };
}

async function sendStart(socket: WebSocket, inbox: MessageInbox, requestId: string) {
  const response = inbox.waitFor(message =>
    (message.type === 'ack' || message.type === 'error') && message.requestId === requestId,
  );
  socket.send(JSON.stringify({ version: 1, type: 'lobby.start', requestId }));
  return response;
}

describe('lobby REST and WebSocket integration', () => {
  beforeEach(async () => {
    app = buildServer(config);
    app.decorate('catalog', [privateCatalogGame]);
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

  it('creates distinct lobbies with the three role-specific links and sessions', async () => {
    const first = await createLobby();
    const second = await createLobby();

    expect(first.version).toBe(1);
    expect(first.host).toMatchObject({ lobbyId: first.lobbyId, role: 'host' });
    expect(first.projector).toMatchObject({ lobbyId: first.lobbyId, role: 'projector' });
    expect(first.host.sessionId).not.toBe(first.projector.sessionId);
    expect(first.host.token).toMatch(/^[A-Za-z0-9_-]{43,}$/);
    expect(first.projector.token).toMatch(/^[A-Za-z0-9_-]{43,}$/);
    expect(first.links).toEqual({
      host: `/lobbies/${first.lobbyId}/host#sessionId=${first.host.sessionId}&token=${first.host.token}`,
      player: `/lobbies/${first.lobbyId}/join`,
      projector: `/lobbies/${first.lobbyId}/projector#sessionId=${first.projector.sessionId}&token=${first.projector.token}`,
    });
    expect(second.lobbyId).not.toBe(first.lobbyId);
    expect(second.host.token).not.toBe(first.host.token);
  });

  it('accepts 20-character names, defaults unnamed players, and rejects longer names', async () => {
    const lobby = await createLobby();
    const accepted = await joinPlayer(lobby.lobbyId, { name: 'abcdefghijklmnopqrst' });
    expect(accepted.response.status).toBeGreaterThanOrEqual(200);
    expect(accepted.response.status).toBeLessThan(300);
    expect(accepted.session?.role).toBe('player');

    const tooLong = await joinPlayer(lobby.lobbyId, { name: 'abcdefghijklmnopqrstu' });
    expect(tooLong.response.status).toBe(400);
    expect(ErrorEventSchema.parse(await tooLong.response.json())).toMatchObject({
      type: 'error',
      code: 'INVALID_MESSAGE',
      requestId: null,
    });

    const unnamed = await joinPlayer(lobby.lobbyId);
    expect(unnamed.response.status).toBeGreaterThanOrEqual(200);
    expect(unnamed.response.status).toBeLessThan(300);
    expect(unnamed.session?.role).toBe('player');

    const { snapshot } = await connectAndAuthenticate(lobby.host);
    expect(snapshot.role).toBe('host');
    expect(snapshot.participants.map(participant => participant.name)).toEqual([
      'abcdefghijklmnopqrst',
      'Spieler 2',
    ]);
    expect(snapshot.participants.map(participant => participant.number)).toEqual([1, 2]);
    expect(snapshot.participants.map(participant => participant.id)).not.toContain(lobby.host.sessionId);
  });

  it('authenticates each role, supports more than four players, and keeps credentials and solutions out of snapshots', async () => {
    const lobby = await createLobby();
    const playerSessions = [];
    for (let index = 0; index < 8; index += 1) {
      const joined = await joinPlayer(lobby.lobbyId, { name: `Player ${index + 1}` });
      expect(joined.response.status).toBeGreaterThanOrEqual(200);
      expect(joined.response.status).toBeLessThan(300);
      if (!joined.session) throw new Error('Expected the player session returned by the join endpoint.');
      playerSessions.push(joined.session);
    }

    const [host, projector, player] = await Promise.all([
      connectAndAuthenticate(lobby.host),
      connectAndAuthenticate(lobby.projector),
      connectAndAuthenticate(playerSessions[0]!),
    ]);
    expect(host.snapshot.role).toBe('host');
    expect(projector.snapshot.role).toBe('projector');
    expect(player.snapshot.role).toBe('player');
    // TECH-14: Host sieht Beitritts- und Projektorlink, Projektor nur den Spieler-Link.
    if (host.snapshot.role === 'host') {
      expect(host.snapshot.links.player).toBe(`/lobbies/${lobby.lobbyId}/join`);
      expect(host.snapshot.links.projector).toBe(lobby.links.projector);
    }
    if (projector.snapshot.role === 'projector') {
      expect(projector.snapshot.playerLink).toBe(`/lobbies/${lobby.lobbyId}/join`);
    }

    for (const snapshot of [host.snapshot, projector.snapshot, player.snapshot]) {
      expect(snapshot.participants).toHaveLength(8);
      expect(snapshot.participants.map(participant => participant.name)).toEqual(
        playerSessions.map((_session, index) => `Player ${index + 1}`),
      );
      expect(snapshot.participants.map(participant => participant.id)).not.toContain(lobby.host.sessionId);
      const serialized = JSON.stringify(snapshot);
      // Der Host-Link im Snapshot enthaelt absichtlich das Projektor-Token
      // (der Host erhielt es bereits beim Erstellen der Lobby).
      const forbiddenTokens = snapshot.role === 'host'
        ? [lobby.host.token, ...playerSessions.map(session => session.token)]
        : [lobby.host.token, lobby.projector.token, ...playerSessions.map(session => session.token)];
      for (const token of forbiddenTokens) {
        expect(serialized).not.toContain(token);
      }
      expect(serialized).not.toContain('PRIVATE_QUESTION_TEXT');
      expect(serialized).not.toContain('correctOptionId');
    }
  });

  it('rejects host start with fewer than two players and starts at two', async () => {
    const lobby = await createLobby();
    const host = await connectAndAuthenticate(lobby.host);

    const noPlayers = await sendStart(host.socket, host.inbox, 'start_zero');
    expect(noPlayers.type).toBe('error');
    if (noPlayers.type === 'error') expect(noPlayers.code).toBe('NOT_ENOUGH_PLAYERS');

    const first = await joinPlayer(lobby.lobbyId, { name: 'First' });
    expect(first.session).toBeDefined();
    const onePlayer = await sendStart(host.socket, host.inbox, 'start_one');
    expect(onePlayer.type).toBe('error');
    if (onePlayer.type === 'error') expect(onePlayer.code).toBe('NOT_ENOUGH_PLAYERS');

    const second = await joinPlayer(lobby.lobbyId, { name: 'Second' });
    expect(second.session).toBeDefined();
    const started = await sendStart(host.socket, host.inbox, 'start_two');
    expect(started.type).toBe('ack');
    const overview = await host.inbox.waitFor(message => message.type === 'snapshot' && message.phase === 'overview');
    expect(SnapshotSchema.parse(overview)).toMatchObject({ role: 'host', phase: 'overview' });
  });

  it('forbids player and projector from starting the lobby', async () => {
    const lobby = await createLobby();
    const first = await joinPlayer(lobby.lobbyId, { name: 'First' });
    const second = await joinPlayer(lobby.lobbyId, { name: 'Second' });
    if (!first.session || !second.session) throw new Error('Expected both player sessions.');

    const [player, projector, host] = await Promise.all([
      connectAndAuthenticate(first.session),
      connectAndAuthenticate(lobby.projector),
      connectAndAuthenticate(lobby.host),
    ]);
    const playerAttempt = await sendStart(player.socket, player.inbox, 'player_start');
    const projectorAttempt = await sendStart(projector.socket, projector.inbox, 'projector_start');

    expect(ErrorEventSchema.parse(playerAttempt)).toMatchObject({ code: 'FORBIDDEN', requestId: 'player_start' });
    expect(ErrorEventSchema.parse(projectorAttempt)).toMatchObject({ code: 'FORBIDDEN', requestId: 'projector_start' });

    const hostStart = await sendStart(host.socket, host.inbox, 'host_start_after_denials');
    expect(hostStart.type).toBe('ack');
    const overview = await host.inbox.waitFor(message => message.type === 'snapshot' && message.phase === 'overview');
    expect(SnapshotSchema.parse(overview)).toMatchObject({ role: 'host', phase: 'overview' });
  });

  it('rejects invalid session and token authentication without sending a snapshot', async () => {
    const lobby = await createLobby();
    const attempts = [
      { sessionId: lobby.host.sessionId, token: 'A'.repeat(43) },
      { sessionId: 'unknown_session', token: lobby.host.token },
    ];

    for (const [index, attempt] of attempts.entries()) {
      const socket = await openSocket();
      const inbox = createInbox(socket);
      const requestId = `invalid_auth_${index}`;
      const firstResponse = inbox.waitFor(() => true);
      socket.send(JSON.stringify({
        version: 1,
        type: 'auth',
        requestId,
        lobbyId: lobby.lobbyId,
        sessionId: attempt.sessionId,
        token: attempt.token,
      }));

      const response = await firstResponse;
      expect(ErrorEventSchema.parse(response)).toMatchObject({ code: 'UNAUTHORIZED', requestId });
      await expect(inbox.waitFor(message => message.type === 'snapshot', 100)).rejects.toThrow(
        'Timed out waiting for a WebSocket message.',
      );
    }
  });

  it('rejects an untrusted WebSocket origin before authentication', async () => {
    const accepted = await openSocket();
    accepted.terminate();

    const rejectedSocket = new WebSocket(`${wsUrl}/ws`, { origin: 'https://untrusted.example' });
    clients.push(rejectedSocket);
    const outcome = await new Promise<'opened' | 'rejected'>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out waiting for origin rejection.')), 2_000);
      rejectedSocket.once('open', () => {
        clearTimeout(timer);
        resolve('opened');
      });
      rejectedSocket.once('unexpected-response', (_request, response) => {
        response.resume();
        clearTimeout(timer);
        resolve('rejected');
      });
      rejectedSocket.once('error', () => {
        clearTimeout(timer);
        resolve('rejected');
      });
    });

    expect(outcome).toBe('rejected');
  });

  it('handles malformed JSON frames without sending a snapshot or taking down HTTP', async () => {
    const lobby = await createLobby();
    const socket = await openSocket();
    const inbox = createInbox(socket);
    const outcome = await new Promise<{ kind: 'closed' } | { kind: 'message'; message: ServerMessage }>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Malformed frame was neither rejected nor closed.')), 2_000);
      socket.once('close', () => {
        clearTimeout(timer);
        resolve({ kind: 'closed' });
      });
      inbox.waitFor(() => true, 1_800).then((message) => {
        clearTimeout(timer);
        resolve({ kind: 'message', message });
      }, reject);
      socket.send('{malformed-json');
    });

    if (outcome.kind === 'message') {
      expect(ErrorEventSchema.parse(outcome.message)).toMatchObject({ code: 'INVALID_MESSAGE' });
    }
    const health = await fetch(`${baseUrl}/health`);
    expect(health.status).toBe(200);
    const validClient = await connectAndAuthenticate(lobby.host);
    expect(validClient.snapshot.role).toBe('host');
  });
});
