# Review BUG-8 — Sorting-Ergebnisse ohne Platzierung

**Reviewer:** code_reviewer
**Implementiert von:** server_developer
**Branch:** BUG-8

## Scope

- `apps/server/src/game.ts` — Evaluation-Projektion: Sorting-Ergebnisse
  erhalten `rank` aus den Punkten (1 + Anzahl Spieler mit mehr Punkten)
- `apps/server/test/game-state.test.ts` — `expectedResults` der
  Sorting-Evaluation assertieren `rank: 1`/`rank: 2`

## Root Cause

`results[].rank` wurde ausschliesslich aus `estimate?.rank` gespeist.
`estimateScores` liefert nur fuer `kind === 'estimation'` Eintraege — bei
Sorting blieb `rank` immer `null`, und `Results` im Web rendert
`rank ?? "–"`. Quiz ist bewusst ranglos (`withRank = kind !== "quiz"`,
kein Anzeige-Bug).

## Findings

- **Ranglogik**: identische Tie-Konvention wie Estimation
  (`1 + others.filter(other.points > points).length`) — geteilte Plaetze
  bekommen denselben Rang, Luecken danach sind korrekt.
- **Estimation unveraendert**: `estimate?.rank ?? null` greift weiter;
  Best-Bonus und Tiers sind unangetastet.
- **Quiz unveraendert**: `rank` bleibt `null` — der Web-Client zeigt bei
  Quiz ohnehin keine Rang-Spalte.
- Punkte-Sammlung zuerst (`scored`), Rang-Vergleich ueber dieselbe
  Teilnehmermenge — Spieler ohne Antwort bekommen `points 0` und damit
  den schlechteren Rang, wie erwartet.
- Kein Contract-/Dependency-Impact (`rank` im Schema bereits
  `int().positive().nullable()`).

## Evidence

- Rot: `BUG-8-2026-10-30T11-07-39-672Z.json` (exit 1 — rank war null)
- Gruen: `BUG-8-2026-10-30T11-08-54-275Z.json` (exit 0, 82/82)
- Lint: `BUG-8-2026-10-30T11-09-56-167Z.json` (exit 0)

## Fazit

Freigabe ohne Blocker.
