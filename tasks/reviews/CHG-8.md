# CHG-8 code review

**Result: APPROVED.**

Reviewed the branch diff: `GameViews.tsx`, `app.css`,
`game-views.test.tsx` (plus uebernommene Nutzer-Edits: Seeds-Regeltexte,
Projektor-„Spielübersicht"-h2, `.player-identity`-Margin).

## Akzeptanzkriterien

- **Schätzen/Projektor:** `.projector-question` und
  `.projector-game .solution` auf 1.8rem (h3 2.2rem) — Frage, Loesung und
  Sortierreihenfolge groesser. `Results` sortiert Eintraege mit Abstand
  aufsteigend (null-Distanzen hinten/stabil).
- **Schätzen/Spieler:** Evaluation zeigt nur abgegebene Antwort, Abstand
  und Punkte — Aufloesungs-Box (`h3 „Auflösung"`, Fragetext, Ziel)
  entfernt.
- **Quiz/Spieler:** gleiche Entfernung; `.answer-mark`-Spans („Richtig",
  „Falsch", „Deine Antwort") entfernt — Farbe reicht; `aria-label` auf
  den `li` erhaelt die Semantik fuer Screenreader.
- **Flash:** `answer-flash-own`/`answer-flash-missed` auf dem richtigen
  Quiz-Tile — 0.5s × 6 alternate = 3 s, pendelt tuerkis↔rot (gewaehlt)
  bzw. tuerkis↔grau (nicht gewaehlt), endet auf tuerkis.
- **Sortieren/Spieler:** Aufloesungs-Box und Marktexte entfernt;
  „Deine abgegebene Antwort"-Paragraph nur noch bei Schätzen (dort als
  Wertanzeige noetig).

## Findings

- Keine Findings. Projektor-SolutionContent bleibt unveraendert
  (Marktexte dort weiterhin gewuenscht). Kein Contract-/Stack-Bezug.

## Evidence

- Rot: `tasks/evidence/CHG-8-2026-10-27T16-59-36-700Z.json` (exit 1)
- Gruen: `tasks/evidence/CHG-8-2026-10-27T17-00-16-248Z.json` (70/70, exit 0)
- Lint/Typecheck: `tasks/evidence/CHG-8-<lint>.json` (exit 0)
