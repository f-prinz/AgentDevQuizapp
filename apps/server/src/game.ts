import { randomUUID } from 'node:crypto';
import {
  AnswerSchema,
  ErrorCodeSchema,
  GameMetadataSchema,
  GameSeedSchema,
  TimerSchema,
  type Answer,
  type GameKindSchema,
  type GameSeed,
  type RankingEntry,
  type Session,
} from '@raccoons/contracts';

export type GameErrorCode = ReturnType<typeof ErrorCodeSchema.parse>;
type Role = Session['role'];
type GameKind = ReturnType<typeof GameKindSchema.parse>;

export interface GamePlayerState {
  id: string;
  name: string;
  number: number;
  connected: boolean;
  answer: Answer | null;
  final: boolean;
}

export interface ActiveGameRound {
  roundId: string;
  seed: GameSeed;
  questionIndex: number;
  participantIds: string[];
  deadline: number | null;
  acceptUntil: number | null;
  inputClosed: boolean;
  sortingOrders: Map<string, string[]>;
  totalPoints: Map<string, number>;
}

export interface RankingTransitionState {
  resultId: string;
  gameId: string;
  previous: RankingEntry[];
  current: RankingEntry[];
}

export interface GameLobbyState {
  id: string;
  phase: 'lobby' | 'overview' | 'start' | 'playing' | 'evaluation';
  revision: number;
  players: GamePlayerState[];
  selectedGameId: string | null;
  playedGameIds: Set<string>;
  completedGames: Map<string, Map<string, number>>;
  rankingTransition: RankingTransitionState | null;
  round: ActiveGameRound | null;
}

function error(code: string): GameErrorCode {
  return ErrorCodeSchema.parse(code);
}

function catalogSeeds(catalog: unknown): GameSeed[] {
  if (!Array.isArray(catalog)) return [];
  return catalog.flatMap((value: unknown) => {
    const parsed = GameSeedSchema.safeParse(value);
    return parsed.success ? [parsed.data] : [];
  });
}

function gameQuestionCount(seed: GameSeed): number {
  return seed.kind === 'quiz' ? seed.questions.length : 1;
}

function currentQuestion(seed: GameSeed, questionIndex: number): string {
  if (seed.kind === 'quiz') return seed.questions[questionIndex]?.question ?? '';
  return seed.question;
}

function durationMs(kind: GameKind): number {
  return kind === 'sorting' ? 60_000 : 30_000;
}

function shuffled(ids: string[]): string[] {
  const result = [...ids];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex]!, result[index]!];
  }
  return result;
}

function sortingOrderForPlayer(round: ActiveGameRound, playerId: string, termIds: string[]): string[] {
  const cachedOrder = round.sortingOrders.get(playerId);
  if (cachedOrder) return cachedOrder;

  const order = shuffled(termIds);
  round.sortingOrders.set(playerId, order);
  return order;
}

function resetInputs(lobby: GameLobbyState, round: ActiveGameRound): void {
  for (const player of lobby.players) {
    player.final = false;
    player.answer = null;
    if (round.seed.kind === 'sorting' && round.participantIds.includes(player.id)) {
      const order = shuffled(round.seed.terms.map(term => term.id));
      round.sortingOrders.set(player.id, order);
      player.answer = { kind: 'sorting', termIds: [...order] };
    }
  }
}

export function selectGame(
  lobby: GameLobbyState,
  role: Role,
  gameId: string | null,
  catalog: unknown,
): GameErrorCode | undefined {
  if (role !== 'host') return error('FORBIDDEN');
  if (lobby.phase !== 'overview') return error('INVALID_PHASE');

  if (gameId !== null) {
    const game = catalogSeeds(catalog).find(item => item.id === gameId);
    if (!game) return error('GAME_NOT_FOUND');
    if (lobby.playedGameIds.has(gameId)) return error('GAME_ALREADY_PLAYED');
  }

  if (lobby.selectedGameId !== gameId) {
    lobby.selectedGameId = gameId;
    lobby.revision += 1;
  }
  return undefined;
}

export function prepareGame(
  lobby: GameLobbyState,
  role: Role,
  catalog: unknown,
): GameErrorCode | undefined {
  if (role !== 'host') return error('FORBIDDEN');
  if (lobby.phase !== 'overview') return error('INVALID_PHASE');
  if (!lobby.selectedGameId) return error('INVALID_PHASE');

  const seed = catalogSeeds(catalog).find(item => item.id === lobby.selectedGameId);
  if (!seed) return error('GAME_NOT_FOUND');

  const round: ActiveGameRound = {
    roundId: randomUUID(),
    seed,
    questionIndex: 0,
    participantIds: lobby.players.map(player => player.id),
    deadline: null,
    acceptUntil: null,
    inputClosed: false,
    sortingOrders: new Map(),
    totalPoints: new Map(lobby.players.map(player => [player.id, 0] as const)),
  };
  resetInputs(lobby, round);
  lobby.round = round;
  lobby.phase = 'start';
  lobby.revision += 1;
  return undefined;
}

export function startGame(
  lobby: GameLobbyState,
  role: Role,
  roundId: string,
  now: number,
): GameErrorCode | undefined {
  if (role !== 'host') return error('FORBIDDEN');
  const round = lobby.round;
  if (!round || round.roundId !== roundId) return error('STALE_ROUND');
  if (lobby.phase !== 'start') return error('INVALID_PHASE');

  const deadline = now + durationMs(round.seed.kind);
  if (!Number.isSafeInteger(deadline) || deadline < 0) return error('INTERNAL_ERROR');
  round.deadline = deadline;
  round.acceptUntil = deadline + 2_000;
  round.inputClosed = false;
  lobby.phase = 'playing';
  lobby.revision += 1;
  return undefined;
}

export function closeExpiredInput(lobby: GameLobbyState, now: number): boolean {
  const round = lobby.round;
  if (lobby.phase !== 'playing' || !round || round.inputClosed || round.acceptUntil === null) return false;
  if (now <= round.acceptUntil) return false;
  round.inputClosed = true;
  lobby.revision += 1;
  return true;
}

function allFrozenPlayersFinal(lobby: GameLobbyState, round: ActiveGameRound): boolean {
  return round.participantIds.length > 0
    && round.participantIds.every(id => lobby.players.find(player => player.id === id)?.final === true);
}

function validateAnswer(round: ActiveGameRound, answer: Answer): boolean {
  const parsed = AnswerSchema.safeParse(answer);
  if (!parsed.success || parsed.data.kind !== round.seed.kind) return false;

  if (round.seed.kind === 'quiz' && parsed.data.kind === 'quiz') {
    const question = round.seed.questions[round.questionIndex];
    const optionId = parsed.data.optionId;
    return question?.options.some(option => option.id === optionId) ?? false;
  }
  if (round.seed.kind === 'sorting' && parsed.data.kind === 'sorting') {
    const expected = new Set(round.seed.terms.map(term => term.id));
    return parsed.data.termIds.length === expected.size
      && parsed.data.termIds.every(id => expected.has(id));
  }
  return round.seed.kind === 'estimation' && parsed.data.kind === 'estimation';
}

export function saveAnswer(
  lobby: GameLobbyState,
  role: Role,
  playerId: string | undefined,
  roundId: string,
  answer: Answer,
  final: boolean,
  now: number,
): GameErrorCode | undefined {
  if (role !== 'player') return error('FORBIDDEN');
  const round = lobby.round;
  if (!round || round.roundId !== roundId) return error('STALE_ROUND');
  if (lobby.phase !== 'playing') return error('INVALID_PHASE');
  if (!playerId || !round.participantIds.includes(playerId)) return error('NOT_PARTICIPATING');
  if (round.inputClosed || round.acceptUntil === null || now > round.acceptUntil) {
    if (!round.inputClosed) closeExpiredInput(lobby, now);
    return error('INPUT_CLOSED');
  }

  const player = lobby.players.find(item => item.id === playerId);
  if (!player) return error('NOT_PARTICIPATING');
  if (player.final) return error('INPUT_CLOSED');
  if (!validateAnswer(round, answer)) return error('INVALID_ANSWER');

  player.answer = parsedAnswer(answer);
  if (final) player.final = true;
  if (final && allFrozenPlayersFinal(lobby, round)) round.inputClosed = true;
  lobby.revision += 1;
  return undefined;
}

function parsedAnswer(answer: Answer): Answer {
  return AnswerSchema.parse(answer);
}

function questionPoints(round: ActiveGameRound, answer: Answer | null): number {
  if (round.seed.kind !== 'quiz' || answer?.kind !== 'quiz') return 0;
  const correctOptionId = round.seed.questions[round.questionIndex]?.correctOptionId;
  return answer.optionId === correctOptionId ? 1 : 0;
}

function hasNextQuestion(round: ActiveGameRound): boolean {
  return round.seed.kind === 'quiz' && round.questionIndex + 1 < round.seed.questions.length;
}

export function revealGame(
  lobby: GameLobbyState,
  role: Role,
  roundId: string,
): GameErrorCode | undefined {
  if (role !== 'host') return error('FORBIDDEN');
  const round = lobby.round;
  if (!round || round.roundId !== roundId) return error('STALE_ROUND');
  if (lobby.phase !== 'playing' || !round.inputClosed) return error('INVALID_PHASE');
  if (round.seed.kind === 'quiz') {
    for (const playerId of round.participantIds) {
      const player = lobby.players.find(item => item.id === playerId);
      const points = questionPoints(round, player?.answer ?? null);
      round.totalPoints.set(playerId, (round.totalPoints.get(playerId) ?? 0) + points);
    }
  }
  lobby.phase = 'evaluation';
  lobby.revision += 1;
  return undefined;
}

export function nextQuestion(
  lobby: GameLobbyState,
  role: Role,
  roundId: string,
  now: number,
): GameErrorCode | undefined {
  if (role !== 'host') return error('FORBIDDEN');
  const current = lobby.round;
  if (!current || current.roundId !== roundId) return error('STALE_ROUND');
  if (lobby.phase !== 'evaluation' || !hasNextQuestion(current)) return error('INVALID_PHASE');

  const deadline = now + durationMs(current.seed.kind);
  const acceptUntil = deadline + 2_000;
  if (!Number.isSafeInteger(deadline) || deadline < 0 || !Number.isSafeInteger(acceptUntil)) {
    return error('INTERNAL_ERROR');
  }
  const next: ActiveGameRound = {
    ...current,
    roundId: randomUUID(),
    questionIndex: current.questionIndex + 1,
    deadline,
    acceptUntil,
    inputClosed: false,
    sortingOrders: new Map(),
    totalPoints: current.totalPoints,
  };
  resetInputs(lobby, next);
  lobby.round = next;
  lobby.phase = 'playing';
  lobby.revision += 1;
  return undefined;
}

export function finishGame(
  lobby: GameLobbyState,
  role: Role,
  roundId: string,
): GameErrorCode | undefined {
  if (role !== 'host') return error('FORBIDDEN');
  const round = lobby.round;
  if (!round || round.roundId !== roundId) return error('STALE_ROUND');
  if (lobby.phase !== 'evaluation' || hasNextQuestion(round)) return error('INVALID_PHASE');

  if (lobby.selectedGameId) {
    lobby.playedGameIds.add(lobby.selectedGameId);
    const previous = projectRanking(lobby);
    const scores = new Map(lobby.players.map(player => [player.id, round.totalPoints.get(player.id) ?? 0] as const));
    lobby.completedGames.set(lobby.selectedGameId, scores);
    const current = projectRanking(lobby);
    lobby.rankingTransition = {
      resultId: randomUUID(),
      gameId: lobby.selectedGameId,
      previous,
      current,
    };
  }
  lobby.selectedGameId = null;
  lobby.round = null;
  lobby.phase = 'overview';
  for (const player of lobby.players) {
    player.answer = null;
    player.final = false;
  }
  lobby.revision += 1;
  return undefined;
}

export function projectRanking(lobby: GameLobbyState): RankingEntry[] {
  if (lobby.completedGames.size === 0) return [];

  const totals = lobby.players.map(player => {
    const games = [...lobby.completedGames].map(([gameId, scores]) => ({
      gameId,
      points: scores.get(player.id) ?? 0,
    }));
    return {
      playerId: player.id,
      name: player.name || `Spieler ${player.number}`,
      total: games.reduce((sum, game) => sum + game.points, 0),
      games,
    };
  });
  return totals.map(entry => ({
    ...entry,
    rank: 1 + totals.filter(other => other.total > entry.total).length,
  }));
}

export function projectRound(
  lobby: GameLobbyState,
  role: Role,
  playerId: string | undefined,
  now: number,
): unknown {
  const round = lobby.round;
  if (!round) return null;
  const metadata = GameMetadataSchema.parse({
    id: round.seed.id,
    kind: round.seed.kind,
    title: round.seed.title,
    rules: round.seed.rules,
  });
  const base = {
    roundId: round.roundId,
    game: metadata,
    questionIndex: round.questionIndex,
    questionCount: gameQuestionCount(round.seed),
  };

  if (lobby.phase === 'start') return { ...base, phase: 'start' };
  if (lobby.phase === 'playing') {
    if (round.deadline === null || round.acceptUntil === null) return null;
    const timer = TimerSchema.parse({
      roundId: round.roundId,
      serverTime: now,
      deadline: round.deadline,
      acceptUntil: round.acceptUntil,
      inputClosed: round.inputClosed,
      canReveal: round.inputClosed,
    });
    const question = currentQuestion(round.seed, round.questionIndex);
    let task: unknown;
    if (round.seed.kind === 'quiz') {
      const quizQuestion = round.seed.questions[round.questionIndex];
      task = role === 'projector'
        ? { kind: 'quiz', question }
        : { kind: 'quiz', question, options: quizQuestion?.options ?? [] };
    } else if (round.seed.kind === 'sorting') {
      if (role === 'player') {
        const order = playerId
          ? sortingOrderForPlayer(round, playerId, round.seed.terms.map(term => term.id))
          : [];
        const byId = new Map(round.seed.terms.map(term => [term.id, term]));
        task = {
          kind: 'sorting',
          question,
          terms: order.flatMap(id => {
            const term = byId.get(id);
            return term ? [{ id: term.id, text: term.text }] : [];
          }),
        };
      } else {
        task = { kind: 'sorting', question };
      }
    } else {
      task = { kind: 'estimation', question };
    }
    return { ...base, phase: 'playing', task, timer };
  }

  if (lobby.phase === 'evaluation') {
    const solution = round.seed.kind === 'quiz'
      ? {
        kind: 'quiz',
        question: currentQuestion(round.seed, round.questionIndex),
        options: round.seed.questions[round.questionIndex]?.options ?? [],
        correctOptionId: round.seed.questions[round.questionIndex]?.correctOptionId ?? '',
      }
      : round.seed.kind === 'sorting'
        ? { kind: 'sorting', question: round.seed.question, terms: round.seed.terms }
        : { kind: 'estimation', question: round.seed.question, target: round.seed.target };
    const hasNext = hasNextQuestion(round);
    if (role === 'player') {
      const player = lobby.players.find(item => item.id === playerId);
      return {
        ...base,
        phase: 'evaluation',
        solution,
        hasNextQuestion: hasNext,
        ownEvaluation: {
          answer: player?.answer ?? null,
          points: questionPoints(round, player?.answer ?? null),
          distance: null,
          positionsCorrect: null,
        },
      };
    }
    return {
      ...base,
      phase: 'evaluation',
      solution,
      hasNextQuestion: hasNext,
      results: round.participantIds.flatMap(id => {
        const player = lobby.players.find(item => item.id === id);
        if (!player) return [];
        return [{
          playerId: player.id,
          name: player.name || `Spieler ${player.number}`,
          points: questionPoints(round, player.answer),
          rank: null,
          distance: null,
          errors: null,
        }];
      }),
    };
  }

  return null;
}
