# Review BUG-6 — Stale rankingTransition re-animiert Rangliste

**Reviewer:** code_reviewer
**Implementiert von:** server_developer (Server), web_developer (Web)
**Branch:** BUG-6

## Scope

- `apps/server/src/game.ts` — `lobby.rankingTransition = null` in
  `nextQuestion` und `finishGame` (Transition wird nach der
  Auswertungs-Phase konsumiert)
- `apps/web/src/GameViews.tsx` — `RankingTable` haengt die Animation an der
  `resultId` statt an der Objekt-Identitaet (`transitionRef` + primitiver
  Effekt-Dependency)
- Tests: `game-state.test.ts` (Overview-Snapshots assertieren null),
  `e2e/lobby.test.ts` + `e2e/quiz.test.ts` (finish/next → null),
  `overview-views.test.tsx` (Re-Delivery derselben resultId animiert nicht;
  neue resultId animiert)

## Root Cause

`lobby.rankingTransition` wurde bei `game.reveal` gesetzt und **nie
zurueckgesetzt** — jeder spaetere Snapshot (Host-Aktion, Spieler-Antwort,
Kick) lieferte dieselbe Transition erneut aus. Der `RankingTable`-Effekt
hing an der Objekt-Identitaet des geparsten Snapshots, also startete die
Animation bei jeder Auslieferung neu. Bei ~20 Spielern = permanente
Re-Animation.

## Findings

- **Server-Fix korrekt**: Transition bleibt waehrend der Evaluation erhalten
  (Reconnects sehen sie), wird aber beim naechsten Phasenwechsel
  (nextQuestion/finishGame) konsumiert — deckt sich mit „nur bei
  Auswertung aktualisieren".
- **Web-Dedupe** schliesst die verbleibende Luecke: mehrfach ausgelieferte
  Snapshots innerhalb der Evaluation (z. B. Disconnect eines Spielers)
  re-animieren nicht; neue resultId loest korrekt neu aus.
- `transitionRef`-Update in eigenem Effekt vor dem Animations-Effekt —
  korrekte Reihenfolge, kein stale-read.
- `ranking` selbst aendert sich durch `projectRanking` ohnehin nur bei
  ausgewerteten Punkten (`totalPoints` waechst nur beim Reveal) — keine
  zusaetzliche Drosselung noetig.
- Keine neuen Dependencies, kein Contract-Impact.

## Evidence

- Rot: `BUG-6-2026-10-30T10-01-40-681Z.json` (exit 1)
- Zwischenlaeufe: `…-171Z.json`, `…-350Z.json`, `…-538Z.json`,
  `…-089Z.json` (flaky E2E-Timeouts in `player-remove`/`catalog-admin`,
  unrelated — Analyse in stderr_tail)
- Gruen Server: `BUG-6-2026-10-30T10-15-06-438Z.json` (exit 0, 82/82)
- Gruen Web: `BUG-6-2026-10-30T10-15-55-839Z.json` (exit 0, 100/100)
- Lint Server: `BUG-6-2026-10-30T10-16-26-023Z.json` (exit 0)
- Lint Web: `BUG-6-2026-10-30T10-16-47-480Z.json` (exit 0)

## Fazit

Freigabe ohne Blocker.
