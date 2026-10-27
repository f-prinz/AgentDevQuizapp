# FEAT-12 code review

**Result: APPROVED.**

Reviewed the branch diff against the acceptance criteria, `docs/project-idea.md`
(F6 Schaetzen) und `docs/agent-context.md`.

## Scope

Diff limited to `apps/web/` (`GameViews.tsx`, `game-views.test.tsx`) +
`tasks/evidence/`. Keine Contract-/Dependency-Aenderung.

## Acceptance criteria

- **Spieler: Zahleneingabefeld** — vorhanden (`input[type=number]`, sendet
  `answer.set` mit `kind:"estimation"`); jetzt explizit getestet.
- **Projektor: Spieler sortiert nach Platzierung mit Abstand** — `Results`
  rendert Platz und Abstand je Spieler; Test belegt Reihenfolge und Werte.
- **Spieler: eigene Eingabe + Abstand** — Bug gefixt: die Auswertung las
  `snapshot.input.answer` (in Phase `evaluation` leer) statt
  `ownEvaluation.answer`; nun werden eigene Schaetzung und
  `ownEvaluation.distance` als "Dein Abstand zur Loesung" angezeigt.
- **Host-Button "weiter"** — vorhandene Auswertungs-Buttons (`game.next` /
  `game.finish` mit "Spiel beenden / Zur Uebersicht") decken die Funktion ab;
  Label-Wording als moeglicher CHG-Wunsch notiert.

## Evidence

- Rot: `tasks/evidence/FEAT-12-2026-10-27T10-05-24-189Z.json` (exit 1)
- Gruen: `tasks/evidence/FEAT-12-2026-10-27T10-06-59-139Z.json` (exit 0, 55/55)
- Lint+Typecheck: `tasks/evidence/FEAT-12-2026-10-27T10-07-08-472Z.json` (exit 0)
- Build: `tasks/evidence/FEAT-12-2026-10-27T10-07-18-217Z.json` (exit 0)
