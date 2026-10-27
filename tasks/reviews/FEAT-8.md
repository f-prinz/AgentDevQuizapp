# FEAT-8 code review

**Result: APPROVED.**

Reviewed the branch diff against the acceptance criteria, `docs/project-idea.md`
(F4 Quiz) and `docs/agent-context.md`.

## Scope

Diff limited to `apps/web/src/GameViews.tsx` + `apps/web/src/game-views.test.tsx`
(+ `tasks/evidence/`). No contract, schema or dependency changes — stack
conform (React/Vite/TS, CSS uses existing `.answer-*`/`answer-marked` classes
from the FEAT-14 theme).

## Acceptance criteria

- **Spieler: 4 Antwortoptionen waehlbar/aenderbar** — bereits vorhanden
  (Radio-Liste + Draft via `answer.set`, Aenderung bis Deadline, `answer.submit`
  final); jetzt explizit mit Test auf genau 4 Optionen belegt.
- **Projektor sieht die Quizfrage** — `ProjectorGameView` zeigt Fragetext +
  Timer, keine Optionen vor Auswertung (Test deckt Geheimhaltung).
- **Host sieht Frage + Antwortoptionen** — unveraendert vorhanden, jetzt mit
  Test belegt.
- **Auswertung markiert eigene und richtige Antwort** — Spieler-Markierung
  bereits vorhanden (FEAT-14); neu: Host- und Projektor-Auswertung rendern die
  Quizloesung als markierte Optionsliste (`data-answer-state=correct` +
  `answer-correct` Klasse + "Richtig"-Label, uebrige Optionen neutral) statt
  eines freien Textes — deckt "Quizfrage und die richtige Antwort" aus
  `Prinzgame.md` visuell ab.

## Findings

- FEAT-4-Test auf "Richtige Antwort: <Text>"-Fliesstext angepasst, da die
  Aufloesung jetzt als Liste rendert; Geheimhaltung vor Auswertung bleibt
  durch eigene Assertions abgesichert. Keine offenen Findings.

## Evidence

- Rot: `tasks/evidence/FEAT-8-2026-10-27T09-52-16-217Z.json` (exit 1)
- Gruen: `tasks/evidence/FEAT-8-2026-10-27T09-54-01-216Z.json` (exit 0, 43/43)
- Lint+Typecheck: `tasks/evidence/FEAT-8-2026-10-27T09-54-18-423Z.json` (exit 0)
