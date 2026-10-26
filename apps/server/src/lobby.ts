import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  CatalogEntrySchema,
  CreateLobbyResponseSchema,
  ErrorCodeSchema,
  GameSeedSchema,
  HostSnapshotSchema,
  JoinPlayerResponseSchema,
  NameSchema,
  PlayerSnapshotSchema,
  ProjectorSnapshotSchema,
  type GameSeed,
  type Session,
  type Snapshot,
} from '@raccoons/contracts';

interface Player {
  id: string;
  name: string;
  number: number;
  connected: boolean;
}

interface StoredSession {
  id: string;
  role: Session['role'];
  tokenHash: Buffer;
  playerId?: string;
}

export interface Lobby {
  id: string;
  phase: 'lobby' | 'overview';
  revision: number;
  players: Player[];
  sessions: Map<string, StoredSession>;
}

export interface AuthenticatedSession {
  lobbyId: string;
  sessionId: string;
  role: Session['role'];
  playerId?: string;
}

export type LobbyErrorCode = ReturnType<typeof ErrorCodeSchema.parse>;

function hashToken(token: string): Buffer {
  return createHash('sha256').update(token).digest();
}

function createSession(lobby: Lobby, role: Session['role'], playerId?: string): Session {
  const sessionId = randomUUID();
  const token = randomBytes(32).toString('base64url');
  const stored: StoredSession = {
    id: sessionId,
    role,
    tokenHash: hashToken(token),
    ...(playerId ? { playerId } : {}),
  };
  lobby.sessions.set(sessionId, stored);
  return { lobbyId: lobby.id, sessionId, role, token };
}

function toAuthenticatedSession(lobby: Lobby, session: StoredSession): AuthenticatedSession {
  return {
    lobbyId: lobby.id,
    sessionId: session.id,
    role: session.role,
    ...(session.playerId ? { playerId: session.playerId } : {}),
  };
}

function publicCatalog(catalog: unknown): Array<{ id: string; kind: GameSeed['kind']; title: string; rules: string; played: boolean }> {
  if (!Array.isArray(catalog)) return [];

  return catalog.flatMap((value: unknown) => {
    const seed = GameSeedSchema.safeParse(value);
    if (!seed.success) return [];
    const { id, kind, title, rules } = seed.data;
    const entry = CatalogEntrySchema.safeParse({ id, kind, title, rules, played: false });
    return entry.success ? [entry.data] : [];
  });
}

export class LobbyRegistry {
  private readonly lobbies = new Map<string, Lobby>();

  create(): ReturnType<typeof CreateLobbyResponseSchema.parse> {
    const id = randomUUID();
    const lobby: Lobby = {
      id,
      phase: 'lobby',
      revision: 0,
      players: [],
      sessions: new Map(),
    };
    const host = createSession(lobby, 'host');
    const projector = createSession(lobby, 'projector');
    this.lobbies.set(id, lobby);

    return CreateLobbyResponseSchema.parse({
      version: 1,
      lobbyId: id,
      host,
      projector,
      links: {
        host: `/lobbies/${id}/host#sessionId=${host.sessionId}&token=${host.token}`,
        player: `/lobbies/${id}/join`,
        projector: `/lobbies/${id}/projector#sessionId=${projector.sessionId}&token=${projector.token}`,
      },
    });
  }

  has(lobbyId: string): boolean {
    return this.lobbies.has(lobbyId);
  }

  joinPlayer(lobbyId: string, rawName: string): ReturnType<typeof JoinPlayerResponseSchema.parse> | undefined {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return undefined;

    const name = NameSchema.parse(rawName);
    const player: Player = {
      id: randomUUID(),
      name,
      number: lobby.players.length + 1,
      connected: false,
    };
    lobby.players.push(player);
    const session = createSession(lobby, 'player', player.id);
    lobby.revision += 1;

    return JoinPlayerResponseSchema.parse({ version: 1, session });
  }

  authenticate(lobbyId: string, sessionId: string, token: string): AuthenticatedSession | LobbyErrorCode {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return ErrorCodeSchema.parse('LOBBY_NOT_FOUND');

    const stored = lobby.sessions.get(sessionId);
    if (!stored) return ErrorCodeSchema.parse('UNAUTHORIZED');

    const providedHash = hashToken(token);
    if (!timingSafeEqual(stored.tokenHash, providedHash)) {
      return ErrorCodeSchema.parse('UNAUTHORIZED');
    }

    return toAuthenticatedSession(lobby, stored);
  }

  getRevision(lobbyId: string): number {
    return this.lobbies.get(lobbyId)?.revision ?? 0;
  }

  setConnected(session: AuthenticatedSession, connected: boolean): boolean {
    const player = this.getPlayer(session);
    if (!player || player.connected === connected) return false;
    player.connected = connected;
    const lobby = this.lobbies.get(session.lobbyId);
    if (lobby) lobby.revision += 1;
    return true;
  }

  start(session: AuthenticatedSession): LobbyErrorCode | undefined {
    if (session.role !== 'host') return ErrorCodeSchema.parse('FORBIDDEN');
    const lobby = this.lobbies.get(session.lobbyId);
    if (!lobby) return ErrorCodeSchema.parse('LOBBY_NOT_FOUND');
    if (lobby.phase !== 'lobby') return ErrorCodeSchema.parse('INVALID_PHASE');
    if (lobby.players.length < 2) return ErrorCodeSchema.parse('NOT_ENOUGH_PLAYERS');

    lobby.phase = 'overview';
    lobby.revision += 1;
    return undefined;
  }

  renamePlayer(session: AuthenticatedSession, rawName: string): LobbyErrorCode | undefined {
    if (session.role !== 'player') return ErrorCodeSchema.parse('FORBIDDEN');
    const player = this.getPlayer(session);
    if (!player) return ErrorCodeSchema.parse('UNAUTHORIZED');

    const name = NameSchema.parse(rawName);
    if (player.name !== name) {
      player.name = name;
      const lobby = this.lobbies.get(session.lobbyId);
      if (lobby) lobby.revision += 1;
    }
    return undefined;
  }

  snapshot(session: AuthenticatedSession, catalog: unknown): Snapshot | undefined {
    const lobby = this.lobbies.get(session.lobbyId);
    if (!lobby) return undefined;

    const common = {
      version: 1 as const,
      type: 'snapshot' as const,
      lobbyId: lobby.id,
      revision: lobby.revision,
      serverTime: Date.now(),
      phase: lobby.phase,
      participants: lobby.players.map(player => ({
        id: player.id,
        name: player.name || `Spieler ${player.number}`,
        number: player.number,
        connected: player.connected,
        waiting: false,
      })),
      catalog: publicCatalog(catalog),
      selectedGameId: null,
      ranking: [],
      rankingTransition: null,
    };

    switch (session.role) {
      case 'host':
        return HostSnapshotSchema.parse({
          ...common,
          role: 'host',
          canStartLobby: lobby.phase === 'lobby' && lobby.players.length >= 2,
          round: null,
        });
      case 'projector':
        return ProjectorSnapshotSchema.parse({ ...common, role: 'projector', round: null });
      case 'player': {
        const player = this.getPlayer(session);
        if (!player) return undefined;
        return PlayerSnapshotSchema.parse({
          ...common,
          role: 'player',
          playerId: player.id,
          input: { answer: null, final: false, participating: true },
          round: null,
        });
      }
    }
  }

  private getPlayer(session: AuthenticatedSession): Player | undefined {
    if (!session.playerId) return undefined;
    return this.lobbies.get(session.lobbyId)?.players.find(player => player.id === session.playerId);
  }
}
