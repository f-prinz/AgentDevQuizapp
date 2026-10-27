# TECH-11 code review

**Result: APPROVED.**

Reviewed the branch diff gegen `docs/project-idea.md` (F2 Ranking) und
die Darstellungsinvarianten aus `docs/agent-context.md`.

## Scope

Nur `apps/web/test/e2e/ranking.test.tsx`, `docs/validation/ranking.md`,
`tasks/evidence/`. Kein Produktivcode.

## Acceptance criteria

- **Rangliste korrekt** — Spaltenkopf Platz/Punkte/Spielername/Spiel N,
  Punktwerte und Rangfolge nach zwei Spielen, Spielspalten nur fuer
  gespielte Spiele; leeres Ranking zeigt nur Namen.
- **Uebergang** — `rankingTransition` rendert vorherige→aktuelle Stände
  (`data-ranking-stage`-Sequenz), Endzustand korrekt.
- **Katalog-Darstellung** — gespielte/unge spielte Spiele korrekt
  getrennt nach links/rechts.
- **Theme** — nur die 4 freigegebenen Farbvariablen; Reduced-Motion-
  Fallback vorhanden (Doku-Assertion).
- **Inventar-/Scope-Audit + Browserbelege** — `docs/validation/ranking.md`.

## Findings (im Task behoben)

- Test las Endstaende waehrend der Animationsphase → Warte jetzt auf
  `data-ranking-stage="after"` (dokumentiertes Muster).

## Evidence

- e2e: `tasks/evidence/TECH-11-2026-10-27T10-29-38-228Z.json` (exit 0)
- Lint+Typecheck: `tasks/evidence/TECH-11-2026-10-27T10-29-50-820Z.json` (exit 0)
