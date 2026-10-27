# Validierung: Sortier-Integration (TECH-9)

Datum: 2026-10-27 · Task: TECH-9 · Komponente: server

## Nachgewiesene Faehigkeiten

`apps/server/test/e2e/sorting.test.ts` (1/1 Test, Evidence
`tasks/evidence/TECH-9-2026-10-27T10-24-09-429Z.json`).

- **Kompletter Sortier-Durchlauf** — Lobby→Uebersicht→`game.start`→
  `answer.set`/`answer.submit`→`game.reveal`→`game.finish`→Uebersicht.
- **Gemischte Begriffe, geheime Werte** — Spieler-Task enthaelt Terme
  (id+text) ohne `value`; Projektor- und Host-Task enthalten weder
  `terms` noch Werte — nur den Spielauftrag.
- **Wertung mit Fehleranzahl** — Ada korrekt aufsteigend (`errors: 0`),
  Bo absteigend (`errors > 0`, weniger Punkte); Solution enthaelt
  aufsteigend sortierte Terme mit Werten.
- **Positionsfeedback** — `ownEvaluation.positionsCorrect` liefert
  `[true,true,true]` (Ada) bzw. mindestens ein `false` (Bo) — Basis der
  farbigen Auswertung im Web-Client.
- **Fruehes Eingabeende** — `inputClosed` wird gesetzt, sobald alle
  Teilnehmenden final abgegeben haben (60s-Deadline muss nicht
  abgewartet werden); erst danach ist `game.reveal` moeglich.
- **Spielende** — Katalogeintrag `played: true`, Ranking gefuellt.

## Browserbelege

Bereits erbracht in FEAT-10/FEAT-14 (Inventar-Anker INV-18):
Drag-and-Drop-Sortierung mit Button-Fallback, farbige Auswertung
pro Position, Projektor- und Host-Darstellung.

## Scope-Audit

Diff: nur `apps/server/test/e2e/sorting.test.ts` + `docs/validation/sorting.md`
+ Evidence — innerhalb `allowed_paths`. Kein Produktivcode geaendert.
