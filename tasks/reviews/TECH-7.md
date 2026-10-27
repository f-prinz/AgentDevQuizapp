# TECH-7 code review

**Result: APPROVED.**

Reviewed the branch diff against the acceptance criteria und
`docs/playbooks/tech.md`.

## Scope

Diff limited to `apps/server/test/e2e/lobby.test.ts` (neu),
`docs/validation/lobby.md` (neu) + `tasks/evidence/` — innerhalb
`allowed_paths`. Reiner Validierungstask, kein produktiver Code geaendert.

## Acceptance criteria

- **Host + Projektor + zwei Spieler real verbunden** — e2e-Test faehrt den
  kompletten Ablauf ueber echte HTTP/WS-Verbindungen (REST-Join,
  `auth`+`ack`, Snapshots, `lobby.start` → `game.select`/`prepare`/`start`
  → `answer.submit` → `game.reveal` → `game.finish`).
- **Unbefugte Moderation abgewiesen** — `lobby.start`/`game.select` eines
  Spielers → `UNAUTHORIZED`/`FORBIDDEN`.
- **Refresh ohne Duplikat** — Reauth stellt `playerId` her, keine
  Doppel-Teilnahme (Host sieht weiter 1 Teilnehmer, connected).
- **Spaeter Beitritt wartet** — `participating: false`, `waiting: true`.
- **Inventar-/Scope-Audit + Browserbelege** — `docs/validation/lobby.md`
  dokumentiert Nachweise, verweist auf FEAT-2/FEAT-4-Browserabnahme und
  fasst den Scope-Audit zusammen.

## Findings (behoben)

- Lint: ungenutzte Join-Bindings entfernt.
- Typcheck: `results`/`ownEvaluation` brauchen Role-Narrowing
  (`role === 'host'|'player'`), ergaenzt.

## Evidence

- e2e: `tasks/evidence/TECH-7-2026-10-27T10-09-19-089Z.json` (exit 0, 4/4)
- Lint+Typecheck: `tasks/evidence/TECH-7-2026-10-27T10-10-35-896Z.json` (exit 0)
