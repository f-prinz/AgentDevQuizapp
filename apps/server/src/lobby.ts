import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  CatalogEntrySchema,
  CreateLobbyResponseSchema,
  GAME_CONFIG,
  ErrorCodeSchema,
  GameSeedSchema,
  HostSnapshotSchema,
  JoinPlayerResponseSchema,
  NameSchema,
  PlayerSnapshotSchema,
  ProjectorSnapshotSchema,
  type Answer,
  type GameSeed,
  type Session,
  type Snapshot,
} from '@raccoons/contracts';
import {
  closeExpiredInput,
  finishGame,
  nextQuestion,
  prepareGame,
  projectRanking,
  projectRound,
  revealGame,
  saveAnswer,
  selectGame,
  startGame,
  type GameLobbyState,
} from './game.ts';

interface Player {
  id: string;
  name: string;
  number: number;
  connected: boolean;
  answer: Answer | null;
  final: boolean;
}

interface StoredSession {
  id: string;
  role: Session['role'];
  tokenHash: Buffer;
  playerId?: string;
}

export interface Lobby extends GameLobbyState {
  sessions: Map<string, StoredSession>;
  links: { host: string; player: string; projector: string };
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

function publicCatalog(
  catalog: unknown,
  playedGameIds: ReadonlySet<string>,
): Array<{ id: string; kind: GameSeed['kind']; title: string; rules: string; played: boolean }> {
  if (!Array.isArray(catalog)) return [];

  return catalog.flatMap((value: unknown) => {
    const seed = GameSeedSchema.safeParse(value);
    if (!seed.success) return [];
    const { id, kind, title } = seed.data;
    const entry = CatalogEntrySchema.safeParse({ id, kind, title, rules: GAME_CONFIG[kind].rules, played: playedGameIds.has(id) });
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
      links: { host: '', player: '', projector: '' },
      players: [],
      selectedGameId: null,
      playedGameIds: new Set(),
      completedGames: new Map(),
      rankingTransition: null,
      round: null,
      sessions: new Map(),
    };
    const host = createSession(lobby, 'host');
    const projector = createSession(lobby, 'projector');
    lobby.links = {
      host: `/lobbies/${id}/host#sessionId=${host.sessionId}&token=${host.token}`,
      player: `/lobbies/${id}/join`,
      projector: `/lobbies/${id}/projector#sessionId=${projector.sessionId}&token=${projector.token}`,
    };
    this.lobbies.set(id, lobby);

    return CreateLobbyResponseSchema.parse({
      version: 1,
      lobbyId: id,
      host,
      projector,
      links: lobby.links,
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
      answer: null,
      final: false,
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

  selectGame(session: AuthenticatedSession, gameId: string | null, catalog: unknown): LobbyErrorCode | undefined {
    const lobby = this.lobbies.get(session.lobbyId);
    if (!lobby) return ErrorCodeSchema.parse('LOBBY_NOT_FOUND');
    return selectGame(lobby, session.role, gameId, catalog);
  }

  prepareGame(session: AuthenticatedSession, catalog: unknown): LobbyErrorCode | undefined {
    const lobby = this.lobbies.get(session.lobbyId);
    if (!lobby) return ErrorCodeSchema.parse('LOBBY_NOT_FOUND');
    return prepareGame(lobby, session.role, catalog);
  }

  startGame(session: AuthenticatedSession, roundId: string, now: number): LobbyErrorCode | undefined {
    const lobby = this.lobbies.get(session.lobbyId);
    if (!lobby) return ErrorCodeSchema.parse('LOBBY_NOT_FOUND');
    return startGame(lobby, session.role, roundId, now);
  }

  revealGame(session: AuthenticatedSession, roundId: string): LobbyErrorCode | undefined {
    const lobby = this.lobbies.get(session.lobbyId);
    if (!lobby) return ErrorCodeSchema.parse('LOBBY_NOT_FOUND');
    return revealGame(lobby, session.role, roundId);
  }

  nextQuestion(session: AuthenticatedSession, roundId: string, now: number): LobbyErrorCode | undefined {
    const lobby = this.lobbies.get(session.lobbyId);
    if (!lobby) return ErrorCodeSchema.parse('LOBBY_NOT_FOUND');
    return nextQuestion(lobby, session.role, roundId, now);
  }

  finishGame(session: AuthenticatedSession, roundId: string): LobbyErrorCode | undefined {
    const lobby = this.lobbies.get(session.lobbyId);
    if (!lobby) return ErrorCodeSchema.parse('LOBBY_NOT_FOUND');
    return finishGame(lobby, session.role, roundId);
  }

  answer(
    session: AuthenticatedSession,
    roundId: string,
    answer: Answer,
    final: boolean,
    now: number,
  ): LobbyErrorCode | undefined {
    const lobby = this.lobbies.get(session.lobbyId);
    if (!lobby) return ErrorCodeSchema.parse('LOBBY_NOT_FOUND');
    return saveAnswer(lobby, session.role, session.playerId, roundId, answer, final, now);
  }

  closeExpiredRounds(now: number): string[] {
    const closedLobbyIds: string[] = [];
    for (const lobby of this.lobbies.values()) {
      if (closeExpiredInput(lobby, now)) closedLobbyIds.push(lobby.id);
    }
    return closedLobbyIds;
  }

  snapshot(session: AuthenticatedSession, catalog: unknown, now = Date.now()): Snapshot | undefined {
    const lobby = this.lobbies.get(session.lobbyId);
    if (!lobby) return undefined;
    const ranking = projectRanking(lobby);

    const common = {
      version: 1 as const,
      type: 'snapshot' as const,
      lobbyId: lobby.id,
      revision: lobby.revision,
      serverTime: now,
      phase: lobby.phase,
      participants: lobby.players.map(player => ({
        id: player.id,
        name: player.name || `Spieler ${player.number}`,
        number: player.number,
        connected: player.connected,
        waiting: lobby.round !== null && !lobby.round.participantIds.includes(player.id),
      })),
      catalog: publicCatalog(catalog, lobby.playedGameIds),
      selectedGameId: lobby.selectedGameId,
      ranking: session.role === 'player'
        ? ranking.filter(entry => entry.playerId === session.playerId)
        : ranking,
      rankingTransition: session.role === 'player' ? null : lobby.rankingTransition,
    };

    switch (session.role) {
      case 'host':
        return HostSnapshotSchema.parse({
          links: { player: lobby.links.player, projector: lobby.links.projector },
          ...common,
          role: 'host',
          canStartLobby: lobby.phase === 'lobby' && lobby.players.length >= 2,
          round: projectRound(lobby, 'host', undefined, now),
        });
      case 'projector':
        return ProjectorSnapshotSchema.parse({
          ...common,
          role: 'projector',
          playerLink: lobby.links.player,
          round: projectRound(lobby, 'projector', undefined, now),
        });
      case 'player': {
        const player = this.getPlayer(session);
        if (!player) return undefined;
        return PlayerSnapshotSchema.parse({
          ...common,
          role: 'player',
          playerId: player.id,
          input: {
            answer: player.answer,
            final: player.final,
            participating: lobby.round === null || lobby.round.participantIds.includes(player.id),
          },
          round: projectRound(lobby, 'player', player.id, now),
        });
      }
    }
  }

  private getPlayer(session: AuthenticatedSession): Player | undefined {
    if (!session.playerId) return undefined;
    return this.lobbies.get(session.lobbyId)?.players.find(player => player.id === session.playerId);
  }
}
