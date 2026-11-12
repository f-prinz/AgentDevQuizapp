import type { RankingEntry } from "@raccoons/contracts";

// Ablauf der Ranglisten-Animation nach jedem Spiel (Spec: kurz und knackig,
// insgesamt hoechstens 5 s): alter Stand stehen lassen -> Punkte hochzaehlen
// -> Karten auf neue Plaetze schieben -> Aufsteiger kurz aufblitzen lassen.
export const RANKING_TIMELINE = { holdMs: 600, countMs: 1500, reorderMs: 900, flashMs: 900 } as const;

/** Stabil nach Rang sortiert; bei Gleichstand bleibt die Server-Reihenfolge. */
export function sortByRank(entries: RankingEntry[]): RankingEntry[] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => a.entry.rank - b.entry.rank || a.index - b.index)
    .map(item => item.entry);
}

/** Podium = die ersten drei Eintraege (links -> rechts Platz 1, 2, 3), Feld = der Rest. */
export function splitPodium(entries: RankingEntry[]): { podium: RankingEntry[]; field: RankingEntry[] } {
  const sorted = sortByRank(entries);
  return { podium: sorted.slice(0, 3), field: sorted.slice(3) };
}

export function hasPlayedAnyGame(entries: RankingEntry[]): boolean {
  return entries.some(entry => entry.games.length > 0);
}

/** Spieler mit besserem Rang als vorher (Neue zaehlen nicht). Vergleich ueber
 *  den Rang, nicht die Listenposition — sonst blitzen Gleichplatzierte auf,
 *  nur weil der Server ihre Reihenfolge getauscht hat. */
export function climbers(previous: RankingEntry[], current: RankingEntry[]): Set<string> {
  const before = new Map(previous.map(entry => [entry.playerId, entry.rank]));
  const result = new Set<string>();
  for (const entry of current) {
    const old = before.get(entry.playerId);
    if (old !== undefined && entry.rank < old) result.add(entry.playerId);
  }
  return result;
}

export function interpolateTotal(from: number, to: number, progress: number): number {
  const clamped = Math.min(1, Math.max(0, progress));
  return Math.round(from + (to - from) * clamped);
}
