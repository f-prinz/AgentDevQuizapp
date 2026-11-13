# Review BUG-12 — TS6133: tote Deklarationen in RankingBoard

**Reviewer:** code_reviewer
**Implementiert von:** web_developer (Testaufraeumen: web_test_engineer)

## Root Cause

Nutzer-Commit `f66e056` entfernte den auskommentierten
Spiel-Detail-Renderblock, beließ aber die dazugehoerigen
Deklarationen und Props: `gameLabel`, `KIND_LABEL`, das
`catalog`-Prop am `RankingBoard` und drei Tests, die die
entfernte Per-Game-Anzeige assertierten. Folge: TS6133
(gameLabel/catalog unbenutzt), TS2322 (catalog-Prop am
Aufruf) und zwei Testbrueche im Docker-Build (`tsc`).

## Diff (Branch BUG-12)

- `RankingBoard.tsx`: unbenutztes `KIND_LABEL` entfernt
  (gameLabel/catalog-Kommentare waren bereits in f66e056 weg).
- `ProjectorView.tsx`: `catalog`-Prop am Aufruf entfernt;
  `snapshot.catalog` bleibt fuer `GameList` in Nutzung.
- `ranking-board.test.tsx`: Fixture + `catalog=`-Props +
  `Snapshot`-Import + zwei Detail-Assertions entfernt.
- `overview-views.test.tsx`, `e2e/ranking.test.tsx`:
  Per-Game-Assertions entfernt (Testtitel angepasst).

## Evidence

- Rot: `tasks/evidence/BUG-12-2026-11-13T11-38-57-885Z.json` (exit 1, Lint)
- Gruen: `npm --prefix apps/web test` 135/135; Lint/typecheck sauber
  (finale Evidence auf main).

## Findings

- Das `games`-Feld im `RankingEntry`-Contract bleibt bestehen —
  Datenfluss serverseitig unveraendert, nur die Anzeige ist weg.
- Option B (Feature wiederherstellen) wurde vom Nutzer
  zugunsten von Option A (Cleanup) abgelehnt; das auskommentierte
  Plumbing liegt weiterhin in einem Nutzer-Stash.
- Keine Blocker.

## Fazit

Freigabe ohne Blocker.
