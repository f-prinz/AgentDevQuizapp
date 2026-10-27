# TECH-8 code review

**Result: APPROVED.**

Reviewed the branch diff gegen `docs/project-idea.md` (F4 Quiz),
`contracts/` und den TECH-Scope.

## Scope

Nur `apps/server/test/e2e/quiz.test.ts`, `docs/validation/quiz.md`,
`tasks/evidence/`. Kein Produktivcode.

## Acceptance criteria

- **Vollstaendige Quizrunde e2e** — Lobby→Uebersicht→Start→2 Fragen→Ende,
  reale REST/WS-Verbindungen, Rollen Host/Projektor/2 Spieler.
- **Wertung richtig/falsch/kein Beantworten** — Ada 1P korrekt, Bo 0P
  falsch (F1); beide 0P + `ownEvaluation.answer null` (F2, echte Deadline).
- **Aufloesungssperre** — `game.reveal` vor `inputClosed` → `INVALID_PHASE`.
- **Spaete Abgabe** — Submit nach `inputClosed` → `INPUT_CLOSED`.
- **Rollen-Isolation** — Host sieht Optionen, Projektor nur die Frage.
- **Inventar-/Scope-Audit + Browserbelege** — `docs/validation/quiz.md`.

## Findings (im Task behoben)

- Gepufferte Snapshots alter Runden erfuellten Phasen-Praedikate
  vorzeitig → Waits filtern jetzt `roundId`-spezifisch (dokumentiertes
  Muster in quiz.md).

## Evidence

- e2e: `tasks/evidence/TECH-8-2026-10-27T10-19-55-560Z.json` (exit 0)
- Lint+Typecheck: `tasks/evidence/TECH-8-2026-10-27T10-22-04-696Z.json` (exit 0)
