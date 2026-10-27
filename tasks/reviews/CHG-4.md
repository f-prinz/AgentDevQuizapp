# CHG-4 code review

**Result: APPROVED.**

Reviewed the branch diff: `apps/web/src/GameViews.tsx`, `styles/app.css`,
`game-views.test.tsx`, `overview-views.test.tsx`, `test/e2e/ranking.test.tsx`.

## Akzeptanzkriterien

- **Projektor-Ranking reduziert:** `RankingTable` rendert nur noch die drei
  Spalten Platz / Punkte / Spielername; die per-Spiel-Detailspalten
  (`gameIds`, `gamePoints`, `ranking-col-new`) sind entfernt. Die
  Punkte-Counting-Animation beim Ranglisten-Übergang bleibt erhalten.
  Leerer Stand liefert weiterhin `null` → `ranking-names`-Fallback.
- **Graue Antwortflächen:** Neue `.answer-tile`-Klasse (grauer Hintergrund,
  `--color-grey`). Sortier-Items in `.sortable-terms` tragen `answer-tile`;
  das Schätz-Eingabefeld liegt in `div.answer-tile.estimation-panel`.
  Quiz-Optionen waren bereits grau (`answer-option`).

## Findings

- `scope_auditor`-Inventar: INV-14 (phasenabhängige Views) und Ranking-Anker
  betroffen; Notiz wird angepasst, kein neuer Eintrag (kein neues Feature).
- Kein Stack-/Dependency-/Contract-Bezug; rein Darstellung.
- `ui_step`-Anker der Browserabnahme bleibt manuell verifizierbar (INV-12,
  bekannter Warnzustand).

## Evidence

- Rot: `tasks/evidence/CHG-4-2026-10-27T13-54-52-708Z.json` (exit 1,
  Header-/Tile-Assertions)
- Gruen: `tasks/evidence/CHG-4-2026-10-27T13-57-26-325Z.json` (65/65, exit 0)
- Lint/Typecheck: `tasks/evidence/CHG-4-2026-10-27T13-57-54-380Z.json` (exit 0)
