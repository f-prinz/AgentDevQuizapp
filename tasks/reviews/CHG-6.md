# CHG-6 code review

**Result: APPROVED.**

Reviewed the branch diff: `GameViews.tsx`, `Pages.tsx`, `app.css`,
`app-routes.test.tsx`, `game-views.test.tsx`, `lobby-views.test.tsx`,
`projector-layout.test.tsx`, `apps/server/seeds/sorting.json`.

Enthaelt vom Nutzer vorgenommene Edits (uncommitted auf main, in den Task
uebernommen): Spielanzeige-Section auf dem Projektor entfernt,
↑/↓-Buttons und fieldset aus der Sortierliste entfernt, `.page`-Padding
gekuerzt, Join-h1 ins Formular verschoben, Seed-Planeten ergaenzt.

## Akzeptanzkriterien

- **Rangliste sortiert:** `RankingTable` sortiert `shown` immer nach
  `rank` — auch waehrend der Zaehl-Transition.
- **Spieler-Kopfzeile:** `.player-identity` (h2) oben in jeder
  Player-Phase: `Name - Punkte (Platz)`, ohne Ranglisteneintrag nur der
  Name (aus `ranking` bzw. `participants`).
- **Startphase:** Spieler sehen nur noch "Das Spiel beginnt gleich …" —
  keine Regeln/Aufgabe mehr. Host-Button "Spielphase starten" sendet
  `game.start` (serverseitig host-only, `game.ts:172`) — war schon so.
- **Sortierliste:** `.sortable-terms` ohne `padding-left`, Items
  zentriert (`justify-items: center`, max. 30rem).

## Findings

- Keine Findings. Kein Contract-/Stack-Bezug, keine neuen Dependencies.
- Test-Anpassungen: Spielanzeige-Region-Queries → `.projector-game`;
  jsdom kann dnd-kit-Drag-Bewegungen nicht simulieren (kein Layout) —
  DnD-Test prueft Verdrahtung (role/tabindex/touch-action);
  CHG-1-Assertion erlaubt den Namen nun in `.player-identity`.

## Evidence

- Rot: `tasks/evidence/CHG-6-2026-10-27T15-15-33-243Z.json` (exit 1)
- Gruen: `tasks/evidence/CHG-6-2026-10-27T15-17-12-900Z.json` (68/68, exit 0)
- Lint/Typecheck: `tasks/evidence/CHG-6-2026-10-27T15-17-38-868Z.json` (exit 0)
