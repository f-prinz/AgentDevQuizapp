import { z } from 'zod';
import { CommandBase, FiniteNumberSchema, GameKindSchema, IdSchema, TextSchema, uniqueIds } from './common.schema.js';
import { TimerSchema } from './timer.schema.js';

// TECH-19: Optionales value an Quiz-Optionen — additiv/abwaertskompatibel,
// rein informativ (Projektor-Aufloesung CHG-22), kein Einfluss auf Punkte.
export const OptionSchema = z.strictObject({ id: IdSchema, text: TextSchema, value: FiniteNumberSchema.optional() });
// TECH-20: 2 bis 6 Optionen (vorher fix 4) — erlaubt Ja/Nein- und
// Zwei-Optionen-Fragen sowie laengere Listen; unique ids bleiben Pflicht.
export const OptionsSchema = z.array(OptionSchema).min(2).max(6).refine(uniqueIds, 'option IDs must be unique');
export const TermSchema = z.strictObject({ id: IdSchema, text: TextSchema });
export const TermsSchema = z.array(TermSchema).min(2).refine(uniqueIds, 'term IDs must be unique');
export const GameMetadataSchema = z.strictObject({ id: IdSchema, kind: GameKindSchema, title: TextSchema, rules: TextSchema });
export const CatalogEntrySchema = GameMetadataSchema.extend({ played: z.boolean() });
export const AnswerSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('quiz'), optionId: IdSchema }),
  z.strictObject({ kind: z.literal('sorting'), termIds: z.array(IdSchema).min(2).refine(ids => new Set(ids).size === ids.length, 'term IDs must be unique') }),
  z.strictObject({ kind: z.literal('estimation'), value: FiniteNumberSchema }),
]);
export type Answer = z.infer<typeof AnswerSchema>;
export const PlayerInputSchema = z.strictObject({ answer: AnswerSchema.nullable(), final: z.boolean(), participating: z.boolean() });
export const GameSelectCommandSchema = z.strictObject({ ...CommandBase, type: z.literal('game.select'), gameId: IdSchema.nullable() });
export const GameActionCommandSchema = z.discriminatedUnion('type', [
  z.strictObject({ ...CommandBase, type: z.literal('game.prepare') }),
  z.strictObject({ ...CommandBase, type: z.literal('game.start'), roundId: IdSchema }),
  z.strictObject({ ...CommandBase, type: z.literal('game.reveal'), roundId: IdSchema }),
  z.strictObject({ ...CommandBase, type: z.literal('game.next'), roundId: IdSchema }),
  z.strictObject({ ...CommandBase, type: z.literal('game.finish'), roundId: IdSchema }),
]);
export const AnswerCommandSchema = z.discriminatedUnion('type', [
  z.strictObject({ ...CommandBase, type: z.literal('answer.set'), roundId: IdSchema, answer: AnswerSchema }),
  z.strictObject({ ...CommandBase, type: z.literal('answer.submit'), roundId: IdSchema, answer: AnswerSchema }),
]);
const RoundBase = { roundId: IdSchema, game: GameMetadataSchema, questionIndex: z.number().int().nonnegative(), questionCount: z.number().int().positive() };
const TaskBase = { question: TextSchema };
export const PublicTaskSchema = z.discriminatedUnion('kind', [
  z.strictObject({ ...TaskBase, kind: z.literal('quiz') }),
  z.strictObject({ ...TaskBase, kind: z.literal('sorting') }),
  z.strictObject({ ...TaskBase, kind: z.literal('estimation') }),
]);
export const HostTaskSchema = z.discriminatedUnion('kind', [
  z.strictObject({ ...TaskBase, kind: z.literal('quiz'), options: OptionsSchema }),
  z.strictObject({ ...TaskBase, kind: z.literal('sorting') }),
  z.strictObject({ ...TaskBase, kind: z.literal('estimation') }),
]);
export const PlayerTaskSchema = z.discriminatedUnion('kind', [
  z.strictObject({ ...TaskBase, kind: z.literal('quiz'), options: OptionsSchema }),
  z.strictObject({ ...TaskBase, kind: z.literal('sorting'), terms: TermsSchema }),
  z.strictObject({ ...TaskBase, kind: z.literal('estimation') }),
]);
export const SolutionSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('quiz'), question: TextSchema, options: OptionsSchema, correctOptionId: IdSchema })
    .refine(value => value.options.some(option => option.id === value.correctOptionId), 'correct option must exist'),
  z.strictObject({ kind: z.literal('sorting'), question: TextSchema, terms: z.array(TermSchema.extend({ value: FiniteNumberSchema })).min(2).refine(uniqueIds, 'term IDs must be unique') }),
  z.strictObject({ kind: z.literal('estimation'), question: TextSchema, target: FiniteNumberSchema }),
]);
export const RoundResultSchema = z.strictObject({ playerId: IdSchema, name: TextSchema, points: z.number().int().nonnegative(), rank: z.number().int().positive().nullable(), distance: FiniteNumberSchema.nonnegative().nullable(), errors: z.number().int().nonnegative().nullable() });
export const OwnEvaluationSchema = z.strictObject({ answer: AnswerSchema.nullable(), points: z.number().int().nonnegative(), distance: FiniteNumberSchema.nonnegative().nullable(), positionsCorrect: z.array(z.boolean()).nullable() });
const StartRoundSchema = z.strictObject({ ...RoundBase, phase: z.literal('start') });
const EvaluationBase = { ...RoundBase, phase: z.literal('evaluation'), solution: SolutionSchema, hasNextQuestion: z.boolean() };
export const HostRoundSchema = z.discriminatedUnion('phase', [StartRoundSchema,
  z.strictObject({ ...RoundBase, phase: z.literal('playing'), task: HostTaskSchema, timer: TimerSchema }),
  z.strictObject({ ...EvaluationBase, results: z.array(RoundResultSchema) }),
]);
export const ProjectorRoundSchema = z.discriminatedUnion('phase', [StartRoundSchema,
  z.strictObject({ ...RoundBase, phase: z.literal('playing'), task: PublicTaskSchema, timer: TimerSchema }),
  z.strictObject({ ...EvaluationBase, results: z.array(RoundResultSchema) }),
]);
export const PlayerRoundSchema = z.discriminatedUnion('phase', [StartRoundSchema,
  z.strictObject({ ...RoundBase, phase: z.literal('playing'), task: PlayerTaskSchema, timer: TimerSchema }),
  z.strictObject({ ...EvaluationBase, ownEvaluation: OwnEvaluationSchema }),
]);
// Catalog-only seed model. Never serialize these objects as a wire snapshot.
// TECH-16: Seeds enthalten kein rules — der Regeltext haengt an der Spielart
// (GAME_CONFIG), nicht am einzelnen Spiel. strictObject lehnt rules im Upload ab.
export const QuizQuestionSeedSchema = z.strictObject({ id: IdSchema, question: TextSchema, options: OptionsSchema, correctOptionId: IdSchema })
  .refine(value => value.options.some(option => option.id === value.correctOptionId), 'correct option must exist');
const GameSeedBaseSchema = z.strictObject({ id: IdSchema, kind: GameKindSchema, title: TextSchema });
export const GameSeedSchema = z.discriminatedUnion('kind', [
  GameSeedBaseSchema.extend({ kind: z.literal('quiz'), questions: z.array(QuizQuestionSeedSchema).min(1).refine(uniqueIds, 'question IDs must be unique') }),
  GameSeedBaseSchema.extend({ kind: z.literal('sorting'), question: TextSchema, terms: z.array(TermSchema.extend({ value: FiniteNumberSchema })).min(2)
    .refine(uniqueIds, 'term IDs must be unique').refine(items => new Set(items.map(item => item.value)).size === items.length, 'sorting values must be unique') }),
  GameSeedBaseSchema.extend({ kind: z.literal('estimation'), question: TextSchema, target: FiniteNumberSchema }),
]);
export type GameSeed = z.infer<typeof GameSeedSchema>;
export type GameMetadata = z.infer<typeof GameMetadataSchema>;
export type RoundResult = z.infer<typeof RoundResultSchema>;
