# TECH-9 code review

**Result: APPROVED.**

Reviewed the branch diff gegen `docs/project-idea.md` (F5 Sortieren)
und `contracts/`.

## Scope

Nur `apps/server/test/e2e/sorting.test.ts`, `docs/validation/sort.md`,
`tasks/evidence/`. Kein Produktivcode.

## Acceptance criteria

- **Sortierspiel vollstaendig e2e** — Lobby→Start→Draft/Final→Aufloesung→
  Ende, 2 Spieler ueber echte WS-Verbindungen.
- **Wertung: komplette Reihenfolge + Fehler** — `errors`-Feld und
  `positionsCorrect`-Array geprueft; Ada 0 Fehler > Bo.
- **Geheimhaltung** — Spieler erhalten Terme ohne `value`;
  Projektor/Host sehen keine `terms` vor der Auswertung.
- **Solution mit Werten** — aufsteigend sortiert, Werte sichtbar.
- **Inventar-/Scope-Audit + Browserbelege** — `docs/validation/sorting.md`.

## Hinweis

`inputClosed` frueh durch all-final Abgaben — der Test deckt dadurch
zugleich den Draft/Final-Pfad (`answer.set` + `answer.submit`) ab;
der reine Deadline-Pfad wurde in TECH-8 e2e belegt.

## Evidence

- e2e: `tasks/evidence/TECH-9-2026-10-27T10-24-09-429Z.json` (exit 0)
- Lint+Typecheck: `tasks/evidence/TECH-9-2026-10-27T10-24-19-679Z.json` (exit 0)
