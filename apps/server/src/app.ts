import Fastify, { type FastifyInstance } from 'fastify';
import {
  AckEventSchema,
  AuthCommandSchema,
  ClientMessageSchema,
  CreateLobbyRequestSchema,
  ErrorCodeSchema,
  ErrorEventSchema,
  GAME_CONFIG,
  HealthResponseSchema,
  IdSchema,
  JoinPlayerRequestSchema,
  ServerMessageSchema,
  TimeSyncEventSchema,
  type GameSeed,
} from '@raccoons/contracts';
import WebSocket, { WebSocketServer, type RawData } from 'ws';
import { timingSafeEqual } from 'node:crypto';
import { resolve } from 'node:path';
import fastifyStatic from '@fastify/static';
import type { ServerConfig } from './config.ts';
import type { CatalogStore } from './catalog-admin.ts';
import { materializeGameDraft } from './catalog-admin.ts';
import { LobbyRegistry, type AuthenticatedSession, type LobbyErrorCode } from './lobby.ts';

// FEAT-16: Der Laufzeit-Katalog wird in bootstrap.ts als Dekoration gesetzt.
// Ohne Modul-Augmentierung bleibt app.decorate('catalog', …) untypisiert.
function catalogOf(instance: FastifyInstance): GameSeed[] | undefined {
  return (instance as { catalog?: GameSeed[] }).catalog;
}

const healthResponseJsonSchema = HealthResponseSchema.toJSONSchema();
delete healthResponseJsonSchema.$schema;

function errorResponse(statusCode: number) {
  const notFound = statusCode === 404;
  const badRequest = statusCode === 400;
  const unauthorized = statusCode === 401;
  return {
    statusCode,
    payload: ErrorEventSchema.parse({
      version: 1,
      type: 'error',
      requestId: null,
      code: notFound ? 'LOBBY_NOT_FOUND' : badRequest ? 'INVALID_MESSAGE' : unauthorized ? 'UNAUTHORIZED' : 'INTERNAL_ERROR',
      message: notFound ? 'Resource not found.' : badRequest ? 'Invalid request.' : unauthorized ? 'Authentication failed.' : 'Internal server error.',
    }),
  };
}

function getStatusCode(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('statusCode' in error)) {
    return undefined;
  }

  const { statusCode } = error;
  return typeof statusCode === 'number' ? statusCode : undefined;
}

const defaultAllowedOrigins = [
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://[::1]:5173',
];
const maxWebSocketPayload = 16 * 1024;
const authTimeoutMs = 10_000;
const rateLimitWindowMs = 10_000;
const maxMessagesPerWindow = 60;
const defaultHeartbeatIntervalMs = 30_000;
const gameTimerIntervalMs = 100;

export interface BuildServerOptions {
  heartbeatIntervalMs?: number;
  now?: () => number;
  catalogStore?: CatalogStore;
}

interface ConnectionState {
  session?: AuthenticatedSession;
  authTimer: ReturnType<typeof setTimeout>;
  windowStartedAt: number;
  messageCount: number;
  isAlive: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requestIdFrom(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const result = IdSchema.safeParse(value.requestId);
  return result.success ? result.data : null;
}

function messageForError(code: LobbyErrorCode | 'INVALID_MESSAGE' | 'INTERNAL_ERROR'): string {
  switch (code) {
    case 'NOT_ENOUGH_PLAYERS': return 'At least two players must join before the lobby can start.';
    case 'LOBBY_NOT_FOUND': return 'Lobby not found.';
    case 'FORBIDDEN': return 'This role cannot perform that action.';
    case 'INVALID_PHASE': return 'This action is not available in the current phase.';
    case 'UNAUTHORIZED': return 'Authentication failed.';
    case 'PLAYER_NOT_FOUND': return 'Player not found.';
    case 'INVALID_MESSAGE': return 'Invalid message.';
    case 'INTERNAL_ERROR': return 'Internal server error.';
    default: return 'The request could not be completed.';
  }
}

function sessionKey(session: AuthenticatedSession): string {
  return `${session.lobbyId}:${session.sessionId}`;
}

function decodeMessage(raw: RawData): string {
  if (Array.isArray(raw)) return Buffer.concat(raw).toString('utf8');
  if (Buffer.isBuffer(raw)) return raw.toString('utf8');
  return Buffer.from(raw).toString('utf8');
}

export function buildServer(config: ServerConfig, options: BuildServerOptions = {}): FastifyInstance {
  const heartbeatIntervalMs = options.heartbeatIntervalMs ?? defaultHeartbeatIntervalMs;
  if (!Number.isSafeInteger(heartbeatIntervalMs) || heartbeatIntervalMs <= 0) {
    throw new Error('heartbeatIntervalMs must be a positive safe integer.');
  }

  const app = Fastify({ logger: false });
  const now = options.now ?? Date.now;
  const registry = new LobbyRegistry();
  const websocketServer = new WebSocketServer({ noServer: true, maxPayload: maxWebSocketPayload });
  const connections = new Map<WebSocket, ConnectionState>();
  const sessionConnectionCounts = new Map<string, number>();
  const allowedOrigins = new Set(config.allowedOrigins ?? defaultAllowedOrigins);
  let closing = false;

  const gameTimer = setInterval(() => {
    for (const lobbyId of registry.closeExpiredRounds(now())) broadcast(lobbyId);
  }, gameTimerIntervalMs);
  gameTimer.unref();

  const heartbeatTimer = setInterval(() => {
    for (const socket of websocketServer.clients) {
      const state = connections.get(socket);
      if (!state || socket.readyState !== WebSocket.OPEN) continue;
      if (!state.isAlive) {
        socket.terminate();
        continue;
      }
      state.isAlive = false;
      socket.ping();
    }
  }, heartbeatIntervalMs);
  heartbeatTimer.unref();

  const getCatalog = (): unknown => (app as FastifyInstance & { catalog?: unknown }).catalog ?? [];

  const sendWebSocketMessage = (socket: WebSocket, message: unknown): void => {
    if (socket.readyState !== WebSocket.OPEN) return;
    const validated = ServerMessageSchema.parse(message);
    socket.send(JSON.stringify(validated));
  };

  const sendError = (
    socket: WebSocket,
    code: LobbyErrorCode | 'INVALID_MESSAGE' | 'INTERNAL_ERROR',
    requestId: string | null,
    closeAfter = false,
  ): void => {
    if (socket.readyState !== WebSocket.OPEN) return;
    const event = ErrorEventSchema.parse({
      version: 1,
      type: 'error',
      requestId,
      code: ErrorCodeSchema.parse(code),
      message: messageForError(code),
    });
    socket.send(JSON.stringify(event), () => {
      if (closeAfter && socket.readyState === WebSocket.OPEN) socket.close(1008, 'Request rejected.');
    });
  };

  const sendSnapshot = (socket: WebSocket, session: AuthenticatedSession): void => {
    const snapshot = registry.snapshot(session, getCatalog(), now());
    if (snapshot) sendWebSocketMessage(socket, snapshot);
  };

  const broadcast = (lobbyId: string): void => {
    for (const [socket, state] of connections) {
      if (state.session?.lobbyId === lobbyId) sendSnapshot(socket, state.session);
    }
  };

  const completeMutation = (
    socket: WebSocket,
    session: AuthenticatedSession,
    requestId: string,
    errorCode: LobbyErrorCode | undefined,
  ): void => {
    if (errorCode) {
      sendError(socket, errorCode, requestId);
      if (errorCode === 'INPUT_CLOSED') broadcast(session.lobbyId);
      return;
    }
    sendWebSocketMessage(socket, AckEventSchema.parse({
      version: 1,
      type: 'ack',
      requestId,
      revision: registry.getRevision(session.lobbyId),
    }));
    broadcast(session.lobbyId);
  };

  const handleCommand = (socket: WebSocket, state: ConnectionState, raw: RawData, isBinary: boolean): void => {
    let value: unknown;
    try {
      if (isBinary) throw new Error('Binary messages are not supported.');
      value = JSON.parse(decodeMessage(raw)) as unknown;
    } catch {
      sendError(socket, 'INVALID_MESSAGE', null, true);
      return;
    }

    const parsed = ClientMessageSchema.safeParse(value);
    if (!parsed.success) {
      sendError(socket, 'INVALID_MESSAGE', requestIdFrom(value), !state.session);
      return;
    }
    const command = parsed.data;

    if (!state.session) {
      const auth = AuthCommandSchema.safeParse(command);
      if (!auth.success) {
        sendError(socket, 'UNAUTHORIZED', command.requestId, true);
        return;
      }
      const authenticated = registry.authenticate(auth.data.lobbyId, auth.data.sessionId, auth.data.token);
      if (typeof authenticated === 'string') {
        sendError(socket, authenticated, auth.data.requestId, true);
        return;
      }

      clearTimeout(state.authTimer);
      state.session = authenticated;
      if (authenticated.role === 'player') {
        const key = sessionKey(authenticated);
        sessionConnectionCounts.set(key, (sessionConnectionCounts.get(key) ?? 0) + 1);
        registry.setConnected(authenticated, true);
      }
      sendWebSocketMessage(socket, AckEventSchema.parse({
        version: 1,
        type: 'ack',
        requestId: auth.data.requestId,
        revision: registry.getRevision(authenticated.lobbyId),
      }));
      broadcast(authenticated.lobbyId);
      return;
    }

    if (command.type === 'auth') {
      sendError(socket, 'INVALID_MESSAGE', command.requestId);
      return;
    }

    if (command.type === 'time.sync') {
      sendWebSocketMessage(socket, TimeSyncEventSchema.parse({
        version: 1,
        type: 'time.sync',
        requestId: command.requestId,
        clientTime: command.clientTime,
        serverTime: now(),
      }));
      return;
    }

    if (command.type === 'lobby.start') {
      const errorCode = registry.start(state.session);
      if (errorCode) {
        sendError(socket, errorCode, command.requestId);
        return;
      }
      sendWebSocketMessage(socket, AckEventSchema.parse({
        version: 1,
        type: 'ack',
        requestId: command.requestId,
        revision: registry.getRevision(state.session.lobbyId),
      }));
      broadcast(state.session.lobbyId);
      return;
    }

    if (command.type === 'player.name') {
      const errorCode = registry.renamePlayer(state.session, command.name);
      if (errorCode) {
        sendError(socket, errorCode, command.requestId);
        return;
      }
      sendWebSocketMessage(socket, AckEventSchema.parse({
        version: 1,
        type: 'ack',
        requestId: command.requestId,
        revision: registry.getRevision(state.session.lobbyId),
      }));
      broadcast(state.session.lobbyId);
      return;
    }

    // FEAT-18: Host kickt einen Spieler — Sessions sind danach ungueltig,
    // offene Sockets des Spielers werden geschlossen.
    if (command.type === 'player.remove') {
      const errorCode = registry.removePlayer(state.session, command.playerId);
      if (errorCode) {
        sendError(socket, errorCode, command.requestId);
        return;
      }
      sendWebSocketMessage(socket, AckEventSchema.parse({
        version: 1,
        type: 'ack',
        requestId: command.requestId,
        revision: registry.getRevision(state.session.lobbyId),
      }));
      broadcast(state.session.lobbyId);
      for (const [peer, peerState] of connections) {
        if (peerState.session?.lobbyId === state.session.lobbyId
          && peerState.session?.playerId === command.playerId
          && peer.readyState === WebSocket.OPEN) {
          peer.close(1008, 'Player removed.');
        }
      }
      return;
    }

    if (command.type === 'game.select') {
      completeMutation(
        socket,
        state.session,
        command.requestId,
        registry.selectGame(state.session, command.gameId, getCatalog()),
      );
      return;
    }

    if (command.type === 'game.prepare') {
      completeMutation(
        socket,
        state.session,
        command.requestId,
        registry.prepareGame(state.session, getCatalog()),
      );
      return;
    }

    if (command.type === 'game.start') {
      completeMutation(
        socket,
        state.session,
        command.requestId,
        registry.startGame(state.session, command.roundId, now()),
      );
      return;
    }

    if (command.type === 'game.reveal') {
      completeMutation(
        socket,
        state.session,
        command.requestId,
        registry.revealGame(state.session, command.roundId),
      );
      return;
    }

    if (command.type === 'game.next') {
      completeMutation(
        socket,
        state.session,
        command.requestId,
        registry.nextQuestion(state.session, command.roundId, now()),
      );
      return;
    }

    if (command.type === 'game.finish') {
      completeMutation(
        socket,
        state.session,
        command.requestId,
        registry.finishGame(state.session, command.roundId),
      );
      return;
    }

    if (command.type === 'answer.set' || command.type === 'answer.submit') {
      completeMutation(
        socket,
        state.session,
        command.requestId,
        registry.answer(
          state.session,
          command.roundId,
          command.answer,
          command.type === 'answer.submit',
          now(),
        ),
      );
      return;
    }

  };

  const onUpgrade = (request: import('node:http').IncomingMessage, socket: import('node:stream').Duplex, head: Buffer): void => {
    if (closing) {
      socket.destroy();
      return;
    }

    let requestUrl: URL;
    try {
      requestUrl = new URL(request.url ?? '/', 'http://localhost');
    } catch {
      socket.destroy();
      return;
    }
    if (requestUrl.pathname !== '/ws' || requestUrl.search !== '') {
      socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }

    const origin = request.headers.origin;
    if (origin !== undefined && (typeof origin !== 'string' || !allowedOrigins.has(origin))) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }

    websocketServer.handleUpgrade(request, socket, head, (websocket) => {
      const state: ConnectionState = {
        authTimer: setTimeout(() => {
          sendError(websocket, 'UNAUTHORIZED', null, true);
        }, authTimeoutMs),
        windowStartedAt: Date.now(),
        messageCount: 0,
        isAlive: true,
      };
      connections.set(websocket, state);
      websocket.on('pong', () => {
        state.isAlive = true;
      });
      websocket.on('message', (raw, isBinary) => {
        const now = Date.now();
        if (now - state.windowStartedAt >= rateLimitWindowMs) {
          state.windowStartedAt = now;
          state.messageCount = 0;
        }
        state.messageCount += 1;
        if (state.messageCount > maxMessagesPerWindow) {
          sendError(websocket, 'INVALID_MESSAGE', null, true);
          return;
        }
        handleCommand(websocket, state, raw, isBinary);
      });
      websocket.on('close', () => {
        clearTimeout(state.authTimer);
        connections.delete(websocket);
        if (!state.session || state.session.role !== 'player') return;

        const key = sessionKey(state.session);
        const remaining = (sessionConnectionCounts.get(key) ?? 1) - 1;
        if (remaining > 0) {
          sessionConnectionCounts.set(key, remaining);
          return;
        }
        sessionConnectionCounts.delete(key);
        if (registry.setConnected(state.session, false)) broadcast(state.session.lobbyId);
      });
      websocket.on('error', () => {
        // Transport errors are handled by close cleanup; details may contain
        // connection data and are intentionally not logged.
      });
      websocketServer.emit('connection', websocket, request);
    });
  };

  app.server.on('upgrade', onUpgrade);
  app.addHook('preClose', async () => {
    closing = true;
    clearInterval(heartbeatTimer);
    clearInterval(gameTimer);
    app.server.off('upgrade', onUpgrade);
    for (const [socket, state] of connections) {
      clearTimeout(state.authTimer);
      socket.terminate();
    }
    await new Promise<void>((resolve) => {
      try {
        websocketServer.close(() => resolve());
      } catch {
        resolve();
      }
    });
  });

  const registerApiRoutes = (instance: FastifyInstance): void => {
  instance.get('/health', {
    schema: {
      response: { 200: healthResponseJsonSchema },
    },
  }, async () => HealthResponseSchema.parse({ status: 'ok', version: 1 }));

  instance.post('/lobbies', async (request, reply) => {
    const body = CreateLobbyRequestSchema.safeParse(request.body);
    if (!body.success) {
      const error = errorResponse(400);
      return reply.code(error.statusCode).send(error.payload);
    }
    return reply.code(201).send(registry.create());
  });

  instance.post('/lobbies/:lobbyId/players', async (request, reply) => {
    const params = isRecord(request.params) ? request.params : {};
    const lobbyId = IdSchema.safeParse(params.lobbyId);
    const body = JoinPlayerRequestSchema.safeParse(request.body);
    if (!lobbyId.success || !body.success) {
      const error = errorResponse(400);
      return reply.code(error.statusCode).send(error.payload);
    }
    if (!registry.has(lobbyId.data)) {
      const error = errorResponse(404);
      return reply.code(error.statusCode).send(error.payload);
    }
    const response = registry.joinPlayer(lobbyId.data, body.data.name);
    if (!response) {
      const error = errorResponse(404);
      return reply.code(error.statusCode).send(error.payload);
    }
    broadcast(lobbyId.data);
    return reply.code(201).send(response);
  });

  // FEAT-16: Katalog-Administration. GET ist oeffentlich (Host/Projektor sehen
  // den Katalog ohnehin); POST/DELETE gibt es nur bei gesetztem ADMIN_TOKEN
  // und CatalogStore. In-Memory-Katalog und Datenbank werden synchron gehalten.
  instance.get('/games', async (request) => {
    const games = catalogOf(request.server) ?? [];
    return { games: games.map(game => ({ id: game.id, kind: game.kind, title: game.title, rules: GAME_CONFIG[game.kind].rules })) };
  });

  const catalogStore = options.catalogStore;
  if (config.adminToken && catalogStore) {
    const expected = `Bearer ${config.adminToken}`;
    const isAuthorized = (provided: string | undefined): boolean => {
      if (typeof provided !== 'string' || provided.length !== expected.length) return false;
      return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
    };

    instance.post('/games', async (request, reply) => {
      if (!isAuthorized(request.headers.authorization)) {
        const error = errorResponse(401);
        return reply.code(error.statusCode).send(error.payload);
      }
      let game: GameSeed;
      try {
        game = materializeGameDraft(request.body);
      } catch {
        const error = errorResponse(400);
        return reply.code(error.statusCode).send(error.payload);
      }
      await catalogStore.insert(game);
      catalogOf(request.server)?.push(game);
      return reply.code(201).send({ game: { id: game.id, kind: game.kind, title: game.title, rules: GAME_CONFIG[game.kind].rules } });
    });

    instance.delete('/games/:gameId', async (request, reply) => {
      if (!isAuthorized(request.headers.authorization)) {
        const error = errorResponse(401);
        return reply.code(error.statusCode).send(error.payload);
      }
      const params = isRecord(request.params) ? request.params : {};
      const gameId = IdSchema.safeParse(params.gameId);
      if (!gameId.success) {
        const error = errorResponse(400);
        return reply.code(error.statusCode).send(error.payload);
      }
      const removed = await catalogStore.remove(gameId.data);
      if (!removed) {
        const error = errorResponse(404);
        return reply.code(error.statusCode).send(error.payload);
      }
      const catalog = catalogOf(request.server);
      const index = catalog?.findIndex(game => game.id === gameId.data) ?? -1;
      if (catalog && index >= 0) catalog.splice(index, 1);
      return reply.code(204).send();
    });
  }
  };

  // TECH-15: Das Frontend ruft /api/* auf (lokal strippt der Vite-Proxy, in
  // Produktion gibt es keinen Proxy) — beide Varianten werden registriert.
  app.register(registerApiRoutes);
  app.register(registerApiRoutes, { prefix: '/api' });

  // TECH-15: Produktionsmodus — Web-Build statisch ausliefern; der
  // NotFoundHandler fängt Browser-Navigation auf SPA-Routen ab.
  if (config.staticDir) {
    app.register(fastifyStatic, { root: resolve(config.staticDir) });
  }

  app.setNotFoundHandler((request, reply) => {
    const acceptsHtml = request.method === 'GET'
      && typeof request.headers.accept === 'string'
      && request.headers.accept.includes('text/html');
    if (config.staticDir && acceptsHtml && !request.url.startsWith('/api')) {
      return reply.sendFile('index.html');
    }
    const error = errorResponse(404);
    return reply.code(error.statusCode).send(error.payload);
  });

  app.setErrorHandler((error, request, reply) => {
    const statusCode = getStatusCode(error) === 400 ? 400 : 500;
    request.log.error({ requestId: request.id, statusCode }, 'Request failed');
    const response = errorResponse(statusCode);
    return reply.code(response.statusCode).send(response.payload);
  });

  return app;
}
