# Review BUG-10 — Fragetext in der Spieleransicht entfernen

**Reviewer:** code_reviewer
**Implementiert von:** web_developer (Tests: web_test_engineer)

## Anliegen

Spieler sahen waehrend des Spiels den Fragetext ueber den
Antworten — Verstoß gegen CHG-3 („nur Antwortoptionen + Timer").

## Root Cause

`QuestionPeek` (aus dem UI-Redesign 67a996d) renderte
`round.task.question` als aufklappbaren Button ueber den
Antwortoptionen in `PlayerGameView.tsx`.

## Diff (Branch BUG-10)

- `PlayerGameView.tsx`: Import und `<QuestionPeek>`-Nutzung
  entfernt.
- `player/QuestionPeek.tsx`: Datei geloescht (ungefuehrt).
- `styles/player.css`: `.question-peek`-Regelblock entfernt.
- `game-views.test.tsx`: Peek-Test durch Absenz-Test ersetzt
  („does not show the question text to players while playing");
  FEAT-4-Phasen-Test invertiert (player playing → queryByText null).

## Evidence

- Rot: `tasks/evidence/BUG-10-2026-11-13T10-16-51-529Z.json` (exit 1)
- Gruen + Lint: auf main nach Merge aufgezeichnet.

## Findings

- Verhalten entspricht der dokumentierten CHG-3-/CHG-6-Regel
  (Spieler: nur Antworten + Timer, in Startphase nur Animation).
- INV-14-Notiz um BUG-10-Hinweis ergaenzt.
- Keine Blocker.

## Fazit

Freigabe ohne Blocker.
