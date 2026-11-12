import { randomUUID } from 'node:crypto';
import {
  AnswerSchema,
  ErrorCodeSchema,
  GAME_CONFIG,
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
  // CHG-25: Per-Spieler-Anzeigereihenfolgen — Sorting-Terms und Quiz-Optionen
  // werden pro Spieler und Runde gemischt und hier gecacht (stabil pro Frage).
  displayOrders: Map<string, string[]>;
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

function orderForPlayer(round: ActiveGameRound, playerId: string, ids: string[]): string[] {
  const cachedOrder = round.displayOrders.get(playerId);
  if (cachedOrder) return cachedOrder;

  const order = shuffled(ids);
  round.displayOrders.set(playerId, order);
  return order;
}

function resetInputs(lobby: GameLobbyState, round: ActiveGameRound): void {
  for (const player of lobby.players) {
    player.final = false;
    player.answer = null;
    if (round.seed.kind === 'sorting' && round.participantIds.includes(player.id)) {
      const order = shuffled(round.seed.terms.map(term => term.id));
      round.displayOrders.set(player.id, order);
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
    displayOrders: new Map(),
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
  return answer.optionId === correctOptionId ? GAME_CONFIG.quiz.scoring.pointsPerCorrectAnswer : 0;
}

function sortingTermsByValue(round: ActiveGameRound) {
  if (round.seed.kind !== 'sorting') return [];
  return [...round.seed.terms].sort((left, right) => left.value - right.value);
}

function sortingEvaluation(round: ActiveGameRound, answer: Answer | null) {
  if (round.seed.kind !== 'sorting' || answer?.kind !== 'sorting') {
    return { points: 0, positionsCorrect: null };
  }

  // BUG-9: Abwaerts-Regel — ein Term zaehlt als richtig, wenn sein Wert
  // groesser ist als der des unmittelbar vorherigen Terms; der erste Term
  // zaehlt immer (exakte Position spielt keine Rolle).
  const valueByTermId = new Map(round.seed.terms.map(term => [term.id, term.value]));
  const positionsCorrect = answer.termIds.map((termId, index) => index === 0
    || (valueByTermId.get(termId) ?? Number.NEGATIVE_INFINITY)
      > (valueByTermId.get(answer.termIds[index - 1] ?? '') ?? Number.NEGATIVE_INFINITY));
  return {
    points: positionsCorrect.filter(Boolean).length * GAME_CONFIG.sorting.scoring.pointsPerCorrectPosition,
    positionsCorrect,
  };
}

function answerPoints(round: ActiveGameRound, answer: Answer | null): number {
  if (round.seed.kind === 'quiz') return questionPoints(round, answer);
  if (round.seed.kind === 'sorting') return sortingEvaluation(round, answer).points;
  return 0;
}

interface EstimateScore {
  points: number;
  rank: number;
  distance: number;
}

interface EstimateDistance {
  output: number;
  comparison: number;
  overflow: boolean;
}

function estimateDistance(value: number, target: number): EstimateDistance {
  const direct = Math.abs(value - target);
  if (Number.isFinite(direct)) return { output: direct, comparison: direct, overflow: false };

  // Half-scale before adding so the comparison remains finite when the true difference exceeds MAX_VALUE.
  const comparison = Math.abs(value / 2) + Math.abs(target / 2);
  return { output: Number.MAX_VALUE, comparison, overflow: true };
}

function compareEstimateDistances(left: EstimateDistance, right: EstimateDistance): number {
  if (left.overflow !== right.overflow) return left.overflow ? 1 : -1;
  if (left.comparison < right.comparison) return -1;
  if (left.comparison > right.comparison) return 1;
  return 0;
}

function estimateScores(lobby: GameLobbyState, round: ActiveGameRound): Map<string, EstimateScore> {
  if (round.seed.kind !== 'estimation') return new Map();
  const target = round.seed.target;

  const estimates = round.participantIds.flatMap(playerId => {
    const player = lobby.players.find(item => item.id === playerId);
    const answer = player?.answer;
    if (answer?.kind !== 'estimation' || !Number.isFinite(answer.value)) return [];
    return [{ playerId, distance: estimateDistance(answer.value, target) }];
  });
  if (estimates.length === 0) return new Map();

  const count = estimates.length;
  const minimumDistance = estimates.reduce((minimum, estimate) =>
    compareEstimateDistances(estimate.distance, minimum) < 0 ? estimate.distance : minimum,
  estimates[0]!.distance);
  const upperBoundary = Math.ceil(count / 3);
  const lowerBoundary = Math.ceil((2 * count) / 3);
  return new Map(estimates.map(estimate => {
    const rank = 1 + estimates.filter(other =>
      compareEstimateDistances(other.distance, estimate.distance) < 0).length;
    const scoring = GAME_CONFIG.estimation.scoring;
    const tierPoints = rank <= upperBoundary ? scoring.upperThird : rank > lowerBoundary ? scoring.lowerThird : scoring.middleThird;
    return [estimate.playerId, {
      rank,
      distance: estimate.distance.output,
      points: tierPoints + (compareEstimateDistances(estimate.distance, minimumDistance) === 0 ? scoring.bestBonus : 0),
    }] as const;
  }));
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
  // CHG-12: Die Rangliste aktualisiert sich pro Frage — die Transition wird
  // hier bei jeder Aufloesung gesetzt (previous = zuletzt angezeigter Stand).
  const previous = projectRanking(lobby);
  const estimates = estimateScores(lobby, round);
  for (const playerId of round.participantIds) {
    const player = lobby.players.find(item => item.id === playerId);
    const points = round.seed.kind === 'estimation'
      ? estimates.get(playerId)?.points ?? 0
      : answerPoints(round, player?.answer ?? null);
    round.totalPoints.set(playerId, (round.totalPoints.get(playerId) ?? 0) + points);
  }
  if (lobby.selectedGameId) {
    lobby.rankingTransition = {
      resultId: randomUUID(),
      gameId: lobby.selectedGameId,
      previous,
      current: projectRanking(lobby),
    };
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
    displayOrders: new Map(),
    totalPoints: current.totalPoints,
  };
  resetInputs(lobby, next);
  lobby.round = next;
  lobby.phase = 'playing';
  // BUG-6: Die Transition der letzten Aufloesung ist konsumiert — nicht mehr
  // mitschleppen, sonst re-animiert die Rangliste bei jeder weiteren Aktion.
  lobby.rankingTransition = null;
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
    const scores = new Map(lobby.players.map(player => [player.id, round.totalPoints.get(player.id) ?? 0] as const));
    lobby.completedGames.set(lobby.selectedGameId, scores);
    // CHG-12: Keine neue Transition beim Beenden — die letzte Aufloesung hat
    // den finalen Stand bereits als current publiziert.
  }
  // BUG-6: Transition konsumieren — der finale Stand wurde bereits bei der
  // letzten Aufloesung als current publiziert.
  lobby.rankingTransition = null;
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
  // CHG-12: Immer alle Spieler liefern (auch vor dem ersten abgeschlossenen
  // Spiel) und die laufende Runde als games-Eintrag mitfuehren — so wird die
  // Rangliste nie leer und aktualisiert sich nach jeder Aufloesung.
  const liveRound = lobby.round;
  const totals = lobby.players.map(player => {
    const games = [...lobby.completedGames].map(([gameId, scores]) => ({
      gameId,
      points: scores.get(player.id) ?? 0,
    }));
    if (liveRound) {
      games.push({ gameId: liveRound.seed.id, points: liveRound.totalPoints.get(player.id) ?? 0 });
    }
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
    rules: GAME_CONFIG[round.seed.kind].rules,
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
      if (role === 'projector') {
        task = { kind: 'quiz', question };
      } else if (role === 'player' && playerId) {
        // CHG-25: Spieler sehen die Optionen gemischt (pro Frage stabil),
        // Host behaelt die Seed-Reihenfolge. correctOptionId ist unabhaengig
        // von der Anzeigereihenfolge.
        const optionById = new Map((quizQuestion?.options ?? []).map(option => [option.id, option]));
        const order = orderForPlayer(round, playerId, [...optionById.keys()]);
        task = {
          kind: 'quiz',
          question,
          options: order.flatMap(id => {
            const option = optionById.get(id);
            return option ? [option] : [];
          }),
        };
      } else {
        task = { kind: 'quiz', question, options: quizQuestion?.options ?? [] };
      }
    } else if (round.seed.kind === 'sorting') {
      if (role === 'player') {
        const order = playerId
          ? orderForPlayer(round, playerId, round.seed.terms.map(term => term.id))
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
    const estimates = estimateScores(lobby, round);
    const solution = round.seed.kind === 'quiz'
      ? {
        kind: 'quiz',
        question: currentQuestion(round.seed, round.questionIndex),
        options: round.seed.questions[round.questionIndex]?.options ?? [],
        correctOptionId: round.seed.questions[round.questionIndex]?.correctOptionId ?? '',
      }
      : round.seed.kind === 'sorting'
        ? { kind: 'sorting', question: round.seed.question, terms: sortingTermsByValue(round) }
        : { kind: 'estimation', question: round.seed.question, target: round.seed.target };
    const hasNext = hasNextQuestion(round);
    if (role === 'player') {
      const player = lobby.players.find(item => item.id === playerId);
      const answer = player?.answer ?? null;
      const sortingScore = sortingEvaluation(round, answer);
      const estimate = player ? estimates.get(player.id) : undefined;
      return {
        ...base,
        phase: 'evaluation',
        solution,
        hasNextQuestion: hasNext,
        ownEvaluation: {
          answer,
          points: round.seed.kind === 'estimation' ? estimate?.points ?? 0 : answerPoints(round, answer),
          distance: estimate?.distance ?? null,
          positionsCorrect: sortingScore.positionsCorrect,
        },
      };
    }
    return {
      ...base,
      phase: 'evaluation',
      solution,
      hasNextQuestion: hasNext,
      results: (() => {
        // BUG-8: Punkte erst komplett sammeln — der Sorting-Rang braucht den
        // Vergleich aller Teilnehmer (1 + Anzahl mit mehr Punkten).
        const scored = round.participantIds.flatMap(id => {
          const player = lobby.players.find(item => item.id === id);
          if (!player) return [];
          const estimate = estimates.get(player.id);
          const points = round.seed.kind === 'estimation' ? estimate?.points ?? 0 : answerPoints(round, player.answer);
          return [{ player, estimate, points }];
        });
        return scored.map(({ player, estimate, points }) => ({
          playerId: player.id,
          name: player.name || `Spieler ${player.number}`,
          points,
          rank: round.seed.kind === 'sorting'
            ? 1 + scored.filter(other => other.points > points).length
            : estimate?.rank ?? null,
          distance: estimate?.distance ?? null,
          errors: round.seed.kind === 'sorting' ? round.seed.terms.length - points : null,
        }));
      })(),
    };
  }

  return null;
}
