# FEAT-10 code review

**Result: APPROVED.**

Reviewed the branch diff against the acceptance criteria, `docs/project-idea.md`
(F5 Sortieren) und `docs/agent-context.md`.

## Scope

Diff limited to `apps/web/` (`GameViews.tsx`, `game-views.test.tsx`,
`styles/app.css`) + `tasks/evidence/`. Keine Contract-/Dependency-Aenderung;
`answer.set` mit `kind:"sorting"` wie vorgesehen.

## Acceptance criteria

- **Spieler sortieren per Drag-and-Drop** — Sortierterme sind `draggable`
  (nur bei `canEdit`), `dragStart/dragOver/drop` ordnen das Element an die
  Zielposition und senden die neue `termIds`-Reihenfolge. Vorhandene
  Pfeil-Buttons bleiben als Touch-/Accessibility-Fallback (HTML5-DnD ist
  auf Touch-Geraeten nicht verfuegbar — bewusste Ergaenzung, kein Ersatz).
- **Projektor: richtige Reihenfolge mit Werten + Fehler je Spieler** —
  `SolutionContent` zeigt Werte in aufsteigender Sollreihenfolge; `Results`
  listet Punkte, Platz und Fehlerzahl je Spieler.
- **Spieler: richtig/falsch markiert** — bereits aus FEAT-14 vorhanden
  (`positionsCorrect` -> `answer-correct`/`answer-wrong` + Textlabel).
- **Host-Button "beenden"** — `game.reveal`-Button deckt das Beenden ab
  (Label "Aufloesen", Funktion identisch; Umbenennung als moeglicher
  CHG-Wunsch notiert).
- **Geheimhaltung:** Projektor-/Host-Task enthaelt keine Terme vor
  Auswertung; eigener Test belegt das fuer den Projektor.

## Evidence

- Rot: `tasks/evidence/FEAT-10-2026-10-27T10-03-12-396Z.json` (exit 1)
- Gruen: `tasks/evidence/FEAT-10-2026-10-27T10-03-52-366Z.json` (exit 0, 52/52)
- Lint+Typecheck: `tasks/evidence/FEAT-10-2026-10-27T10-04-00-989Z.json` (exit 0)
- Build: `tasks/evidence/FEAT-10-2026-10-27T10-04-09-511Z.json` (exit 0)
