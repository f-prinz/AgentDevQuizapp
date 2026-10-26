import { z } from 'zod';
import { CommandBase, IdSchema, TimestampSchema } from './common.schema.js';
export const TimerSchema = z.strictObject({ roundId: IdSchema, serverTime: TimestampSchema, deadline: TimestampSchema, acceptUntil: TimestampSchema, inputClosed: z.boolean(), canReveal: z.boolean() })
  .refine(value => value.acceptUntil === value.deadline + 2000, 'acceptUntil must equal deadline + 2000')
  .refine(value => value.inputClosed === value.canReveal, 'reveal requires closed input');
export const TimeSyncCommandSchema = z.strictObject({ ...CommandBase, type: z.literal('time.sync'), clientTime: TimestampSchema });
export const TimeSyncEventSchema = z.strictObject({ ...CommandBase, type: z.literal('time.sync'), clientTime: TimestampSchema, serverTime: TimestampSchema });
export type Timer = z.infer<typeof TimerSchema>;
