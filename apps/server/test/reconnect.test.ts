import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import {
  CreateLobbyResponseSchema,
  ErrorEventSchema,
  JoinPlayerResponseSchema,
  ServerMessageSchema,
  SnapshotSchema,
  type ServerMessage,
  type Session,
} from '@raccoons/contracts';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/app.ts';

const allowedOrigin = 'http://127.0.0.1:5173';
const config = { host: '127.0.0.1', port: 0, allowedOrigins: [allowedOrigin] };

type BuildServerOptions = { heartbeatIntervalMs?: number };
type MessagePredicate = (message: ServerMessage) => boolean;

interface TestServer {
  app: FastifyInstance;
  baseUrl: string;
  wsUrl: string;
}

interface MessageInbox {
  waitFor(predicate: MessagePredicate, timeoutMs?: number): Promise<ServerMessage>;
}

const servers: TestServer[] = [];
const sockets: WebSocket[] = [];

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

async function startTestServer(options?: BuildServerOptions): Promise<TestServer> {
  const app = options ? buildServer(config, options) : buildServer(config);
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

async function closeTestServer(server: TestServer): Promise<void> {
  const index = servers.indexOf(server);
  if (index >= 0) servers.splice(index, 1);
  await server.app.close();
}

async function createLobby(server: TestServer) {
  const response = await fetch(`${server.baseUrl}/lobbies`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  expect(response.status).toBe(201);
  return CreateLobbyResponseSchema.parse(await response.json());
}

async function joinPlayer(server: TestServer, lobbyId: string, name: string) {
  const response = await fetch(`${server.baseUrl}/lobbies/${lobbyId}/players`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  expect(response.status).toBe(201);
  return JoinPlayerResponseSchema.parse(await response.json()).session;
}

async function openSocket(
  server: TestServer,
  options: { autoPong?: boolean; onPing?: () => void } = {},
): Promise<{ socket: WebSocket; inbox: MessageInbox }> {
  const socket = new WebSocket(server.wsUrl, {
    origin: allowedOrigin,
    ...(options.autoPong === undefined ? {} : { autoPong: options.autoPong }),
  });
  if (options.onPing) socket.on('ping', options.onPing);
  sockets.push(socket);
  const inbox = createInbox(socket);
  await new Promise<void>((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });
  return { socket, inbox };
}

async function authenticate(server: TestServer, session: Session, options?: { autoPong?: boolean; onPing?: () => void }) {
  const { socket, inbox } = await openSocket(server, options);
  const requestId = `auth_${session.role}_${session.sessionId}`;
  const ackPromise = inbox.waitFor(message => message.type === 'ack' && message.requestId === requestId);
  const snapshotPromise = inbox.waitFor(message => message.type === 'snapshot' && message.role === session.role);
  socket.send(JSON.stringify({
    version: 1,
    type: 'auth',
    requestId,
    lobbyId: session.lobbyId,
    sessionId: session.sessionId,
    token: session.token,
  }));
  await ackPromise;
  const snapshot = SnapshotSchema.parse(await snapshotPromise);
  return { socket, inbox, snapshot };
}

async function startLobby(socket: WebSocket, inbox: MessageInbox) {
  const requestId = `start_${Date.now()}`;
  const ack = inbox.waitFor(message => message.type === 'ack' && message.requestId === requestId);
  const overview = inbox.waitFor(message => message.type === 'snapshot' && message.phase === 'overview');
  socket.send(JSON.stringify({ version: 1, type: 'lobby.start', requestId }));
  await ack;
  return SnapshotSchema.parse(await overview);
}

function waitForClose(socket: WebSocket, timeoutMs = 2_000): Promise<void> {
  if (socket.readyState === WebSocket.CLOSED) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out waiting for WebSocket close.')), timeoutMs);
    socket.once('close', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

function waitForPing(socket: WebSocket, timeoutMs = 1_500): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out waiting for a server ping.')), timeoutMs);
    socket.once('ping', () => {
      clearTimeout(timer);
      resolve();
    });
    socket.once('close', () => {
      clearTimeout(timer);
      reject(new Error('Connection closed before a server ping.'));
    });
  });
}

async function closeSocket(socket: WebSocket): Promise<void> {
  if (socket.readyState === WebSocket.CLOSED) return;
  const closed = waitForClose(socket);
  socket.close();
  await closed;
}

afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.terminate();
  for (const server of servers.splice(0)) await server.app.close();
});

describe('session reconnect and WebSocket heartbeat', () => {
  it('reauthenticates existing roles and restores the same player without adding another participant', async () => {
    const server = await startTestServer();
    const lobby = await createLobby(server);
    const firstPlayer = await joinPlayer(server, lobby.lobbyId, 'Reconnect player');
    await joinPlayer(server, lobby.lobbyId, 'Second player');

    const originalHost = await authenticate(server, lobby.host);
    const originalProjector = await authenticate(server, lobby.projector);
    const originalPlayer = await authenticate(server, firstPlayer);
    const playerId = originalPlayer.snapshot.role === 'player' ? originalPlayer.snapshot.playerId : '';
    expect(playerId).not.toBe('');
    expect(originalPlayer.snapshot.participants).toHaveLength(2);
    expect(await startLobby(originalHost.socket, originalHost.inbox)).toMatchObject({ phase: 'overview' });

    await Promise.all([
      closeSocket(originalHost.socket),
      closeSocket(originalProjector.socket),
      closeSocket(originalPlayer.socket),
    ]);

    const [reconnectedHost, reconnectedProjector, reconnectedPlayer] = await Promise.all([
      authenticate(server, lobby.host),
      authenticate(server, lobby.projector),
      authenticate(server, firstPlayer),
    ]);
    expect(reconnectedHost.snapshot).toMatchObject({ role: 'host', phase: 'overview' });
    expect(reconnectedProjector.snapshot).toMatchObject({ role: 'projector', phase: 'overview' });
    expect(reconnectedPlayer.snapshot).toMatchObject({
      role: 'player',
      phase: 'overview',
      playerId,
      participants: [
        expect.objectContaining({ id: playerId, name: 'Reconnect player' }),
        expect.objectContaining({ name: 'Second player' }),
      ],
    });
    expect(reconnectedPlayer.snapshot.participants).toHaveLength(2);
  });

  it('keeps a player connected while any authenticated socket for that session remains open', async () => {
    const server = await startTestServer();
    const lobby = await createLobby(server);
    const player = await joinPlayer(server, lobby.lobbyId, 'Shared session');
    const firstConnection = await authenticate(server, player);
    if (firstConnection.snapshot.role !== 'player') throw new Error('Expected a player snapshot.');
    const playerId = firstConnection.snapshot.playerId;
    const secondConnection = await authenticate(server, player);

    await closeSocket(firstConnection.socket);
    const hostAfterFirstClose = await authenticate(server, lobby.host);
    const connectedParticipant = hostAfterFirstClose.snapshot.participants.find(item => item.id === playerId);
    expect(connectedParticipant?.connected).toBe(true);

    const disconnected = hostAfterFirstClose.inbox.waitFor(message =>
      message.type === 'snapshot'
      && message.participants.some(item => item.id === playerId && !item.connected),
    );
    await closeSocket(secondConnection.socket);
    const disconnectedSnapshot = SnapshotSchema.parse(await disconnected);
    expect(disconnectedSnapshot.participants.find(item => item.id === playerId)?.connected).toBe(false);
  });

  it('rejects a session token from a previous server process', async () => {
    const firstProcess = await startTestServer();
    const lobby = await createLobby(firstProcess);
    await closeTestServer(firstProcess);
    const nextProcess = await startTestServer();
    const { socket, inbox } = await openSocket(nextProcess);
    const requestId = 'old_process_session';
    const responsePromise = inbox.waitFor(message => message.type === 'error' || message.type === 'snapshot');
    socket.send(JSON.stringify({
      version: 1,
      type: 'auth',
      requestId,
      lobbyId: lobby.lobbyId,
      sessionId: lobby.host.sessionId,
      token: lobby.host.token,
    }));

    expect(ErrorEventSchema.parse(await responsePromise)).toMatchObject({
      code: 'LOBBY_NOT_FOUND',
      requestId,
    });
  });

  it('pings live clients, keeps auto-pong clients open, and closes silent clients by the next interval', async () => {
    const server = await startTestServer({ heartbeatIntervalMs: 50 });
    let silentClientPings = 0;
    let resolveSilentPing!: () => void;
    const silentPing = new Promise<void>((resolve) => {
      resolveSilentPing = resolve;
    });
    const silentClient = await openSocket(server, {
      autoPong: false,
      onPing: () => {
        silentClientPings += 1;
        resolveSilentPing();
      },
    });
    const closedSilentClient = waitForClose(silentClient.socket);

    const healthyClient = await openSocket(server);
    await waitForPing(healthyClient.socket);
    await waitForPing(healthyClient.socket);
    expect(healthyClient.socket.readyState).toBe(WebSocket.OPEN);

    await Promise.race([silentPing, closedSilentClient]);
    await closedSilentClient;
    expect(silentClientPings).toBeGreaterThan(0);
    expect(silentClient.socket.readyState).toBe(WebSocket.CLOSED);
    await closeTestServer(server);
  });
});
