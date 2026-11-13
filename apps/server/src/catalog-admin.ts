import { randomUUID } from 'node:crypto';
import { GameSeedSchema, type GameSeed } from '@raccoons/contracts';
import type { Pool } from 'pg';
import { deleteGame, insertGame } from './catalog.ts';

/**
 * Laufzeit-Zugriff auf den Spielekatalog (FEAT-16). Der Store kapselt den
 * PostgreSQL-Pool, damit HTTP-Handler keine SQL-Abhaengigkeit bekommen.
 */
export interface CatalogStore {
  insert(game: GameSeed): Promise<void>;
  remove(id: string): Promise<boolean>;
}

export function createCatalogStore(pool: Pool): CatalogStore {
  return {
    insert: game => insertGame(pool, game),
    remove: id => deleteGame(pool, id),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Wandelt ein Upload-Draft-JSON in ein valides GameSeed um. Saemtliche ids
 * (Spiel, Fragen, Optionen, Terms) werden serverseitig als UUID erzeugt —
 * uebergebene ids werden verworfen. Bei Quizfragen kann die richtige Option
 * per `correctOptionIndex` (0-basiert) oder per `correctOptionId` (als
 * Verweis auf eine mitgelieferte Options-id) benannt werden; der Verweis
 * wird auf die generierte id umgeschrieben. Ungueltige Eingaben scheitern
 * anschliessend an GameSeedSchema.
 */
export function materializeGameDraft(input: unknown): GameSeed {
  if (!isRecord(input)) {
    throw new Error('Game draft must be an object.');
  }
  // CHG-11: Regeltexte haengen an der Spielart (GAME_CONFIG) — ein rules-Feld
  // im Upload wird abgelehnt statt gespeichert.
  if ('rules' in input) {
    throw new Error('Game draft must not contain rules; they are defined per game kind.');
  }

  const base = { id: randomUUID(), kind: input.kind, title: input.title };
  let candidate: unknown;

  if (input.kind === 'quiz') {
    const questions = Array.isArray(input.questions)
      ? input.questions.map((question) => {
          if (!isRecord(question)) return question;
          const rawOptions = Array.isArray(question.options) ? question.options : [];
          const optionIds = rawOptions.map(() => randomUUID());
          const options = rawOptions.map((option, index) =>
            isRecord(option) ? { id: optionIds[index], text: option.text, value: option.value } : option);
          const rawIndex = question.correctOptionIndex;
          let correctOptionId: string | undefined;
          if (typeof rawIndex === 'number' && Number.isInteger(rawIndex) && optionIds[rawIndex] !== undefined) {
            correctOptionId = optionIds[rawIndex];
          } else if (typeof question.correctOptionId === 'string') {
            const index = rawOptions.findIndex(option => isRecord(option) && option.id === question.correctOptionId);
            correctOptionId = index >= 0 ? optionIds[index] : undefined;
          }
          return {
            id: randomUUID(),
            question: question.question,
            options,
            ...(correctOptionId !== undefined ? { correctOptionId } : {}),
          };
        })
      : input.questions;
    candidate = { ...base, questions };
  } else if (input.kind === 'sorting') {
    const terms = Array.isArray(input.terms)
      ? input.terms.map(term => (isRecord(term) ? { id: randomUUID(), text: term.text, value: term.value } : term))
      : input.terms;
    candidate = { ...base, question: input.question, terms };
  } else if (input.kind === 'estimation') {
    candidate = { ...base, question: input.question, target: input.target };
  } else {
    candidate = base;
  }

  const parsed = GameSeedSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new Error('Game draft does not match the game seed schema.');
  }
  return parsed.data;
}
