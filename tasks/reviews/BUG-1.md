# BUG-1 code review

**Result: APPROVED.**

Reviewed the branch diff: `apps/server/src/main.ts`, `apps/server/src/bootstrap.ts`.

## Scope

Nur die zwei deklarierten Dateien.

## Acceptance criteria

- **Echte Fehler sichtbar** — `main.ts` loggt `err` statt nur der generischen Meldung; `bootstrap.ts` reicht die Ursache via `{ cause: err }` weiter. Nachweis live: Start ohne gueltige DB-Rolle zeigt `code: '28000'` / "Rolle raccoons hat keine Berechtigung zum Einloggen" — die Diagnose, die den eigentlichen Bug (NOLOGIN-Rolle) sichtbar gemacht hat.
- **Kein Verhalten geaendert** — Startup-Reihenfolge, Cleanup (`app.close()`, `closePool()`) und Exit-Code unveraendert; nur Error-Reporting erweitert.

## Findings

Keine. Stack-konform, keine neuen Dependencies.

## Evidence

- Lint/Typecheck: `tasks/evidence/BUG-1-2026-10-27T12-02-51-886Z.json` (exit 0)
- Tests: `tasks/evidence/BUG-1-2026-10-27T12-03-04-615Z.json` (61/61, exit 0)
