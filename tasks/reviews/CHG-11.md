# Review CHG-11 — Regeln + Punktvergabe aus GAME_CONFIG

Reviewer: code_reviewer (nicht implemented_by server_developer)
Diff-Basis: Branch CHG-11 gegen main (inkl. Merge TECH-16).

## Akzeptanzkriterien

- [x] Regeltext pro Spielart aus `GAME_CONFIG`: `publicCatalog` (lobby.ts:97), `round.game.rules` (game.ts:469), `GET/POST /games` (app.ts:518,543) befuellen `rules` aus der Contract-Map — Seeds/DB enthalten keinen Regeltext mehr.
- [x] Punktvergabe aus `GAME_CONFIG.scoring`: quiz `pointsPerCorrectAnswer` (game.ts:257), sorting `pointsPerCorrectPosition` (:273), estimation `upperThird`/`middleThird`/`lowerThird`/`bestBonus` (:333-338) — Werte bilden das bisherige Verhalten exakt ab (3/1/0 + 2).
- [x] Upload mit `rules` wird mit 400 abgelehnt: expliziter Check in `materializeGameDraft` (catalog-admin.ts:41) — zusaetzlich lehnt das strict `GameSeedSchema` ab.
- [x] Migration `002_games_without_rules.sql`: `content - 'rules'` + `DROP COLUMN rules` — Altdaten bereinigt; ohne das wuerde der strenge Schema-Check beim Boot an Alt-Zeilen scheitern. `catalog.ts` ohne rules-Spalte/Check; Tests bestaetigen fehlende Spalte.

## Prüfpunkte

- **Stack**: keine neuen Dependencies (`GAME_CONFIG` aus contracts, TECH-16).
- **Contract-Flaeche**: Wire unveraendert (Snapshots/Katalog/`/games` liefern weiter `rules`) — kein Web-Umbau; `AdminPage` zeigt `rules` aus `GET /games` weiterhin an.
- **Migration**: transaktional in `applyMigrations`; `content - 'rules'` laeuft vor dem strengen `parseGameRow`-Check — Alt-Zeilen mit rules bleiben ladbar (werden bereinigt, nicht ignoriert).
- **Verhalten**: Scoring-Werte unveraendert; Regeltexte = bestaetigte Alt-Texte (sorting verallgemeinert).
- **Tests**: alle rules-Fixtures bereinigt; neuer Reject-Test (Upload mit rules → 400); Katalog-Test prueft fehlende rules-Spalte; API-Tests erwarten GAME_CONFIG-Regeltexte.

## Befunde

- Keine Blocker.
- Hinweis: `render.yaml` Build-Reihenfolge baut contracts vor dem Server — `GAME_CONFIG` wird in dist kompiliert; deploy-seitig nichts zu tun.

## Evidence

- Rot (TDD): `tasks/evidence/CHG-11-2026-10-28T16-16-58-969Z.json` (exit 1 — Server referenzierte noch rules)
- Zwischenlauf: `tasks/evidence/CHG-11-2026-10-28T16-22-21-765Z.json` (exit 1 — letztes e2e-Fixture mit rules)
- Gruen: `tasks/evidence/CHG-11-2026-10-28T16-23-55-140Z.json` (exit 0, 79/79)
- Lint: `tasks/evidence/CHG-11-2026-10-28T16-23-05-843Z.json` (exit 0)

## Ergebnis

APPROVED — Akzeptanzkriterien erfuellt, keine Blocker.
