# Review TECH-16 — CONTRACT_CHANGE: GAME_CONFIG + GameSeedSchema ohne rules

Reviewer: code_reviewer (nicht implemented_by contracts_developer)
Diff-Basis: Branch TECH-16 gegen main.

## Akzeptanzkriterien

- [x] `contracts/game.config.ts`: `GAME_CONFIG` mit `rules`-Text und `scoring`-Parametern pro Spielart (quiz: pointsPerCorrectAnswer 1; sorting: pointsPerCorrectPosition 1; estimation: upperThird 3 / middleThird 1 / lowerThird 0 / bestBonus 2 — bildet das bisherige Verhalten exakt ab).
- [x] `GameSeedSchema` ohne `rules` — eigene strict `GameSeedBaseSchema` (id/kind/title); Upload/DB-Inhalte mit `rules`-Key werden abgelehnt. `GameMetadataSchema` (Wire) und `CatalogEntrySchema` behalten `rules` → Snapshots und /games bleiben contractstabil, kein Web-Umbau.

## Prüfpunkte

- **Contract-Flaeche**: Schema-Kompatibilitaet bewusst eingeschraenkt auf das Seed-/Upload-Modell; Wire-Snapshots unveraendert (Host/Player/Projector bekommen weiter `round.game.rules` — kuenftig aus GAME_CONFIG befuellt).
- **Regeltexte**: alte Seed-Texte uebernommen (User-Bestaetigung); sorting verallgemeinert („Ordnet die Begriffe…"), da der alte Text planetenspezifisch war.
- **Scoring-Map**: Werte decken die bisherige Implementation in `game.ts` exakt ab (Drittel 3/1/0 + Bestwert-Bonus 2 = 5) — keine Spielmechanik-Aenderung.
- **Vorbestehender Testfehler** (seit d3185b1): protocol.test.mjs-Fixtures ohne `links`/`playerLink` — Schema fordert sie seit Lobby-Flow. Fixtures ergaenzt; ohne Fix bliebe die contracts-Suite rot.

## Befunde

- Keine Blocker.
- Hinweis: Server nutzt GAME_CONFIG in CHG-11; `npm --prefix contracts run build` vor serverseitigem Build noetig (dist-Import).

## Evidence

- Rot (TDD): `tasks/evidence/TECH-16-2026-10-28T16-10-13-866Z.json` (exit 1 — GAME_CONFIG fehlt)
- Zwischenlauf: `tasks/evidence/TECH-16-2026-10-28T16-10-59-326Z.json` (exit 1 — vorbestehende Fixture-Luecken)
- Gruen: `tasks/evidence/TECH-16-2026-10-28T16-12-39-208Z.json` (exit 0)
- Lint/Typecheck: `tasks/evidence/TECH-16-2026-10-28T16-11-01-747Z.json` (exit 0)

## Ergebnis

APPROVED — Akzeptanzkriterien erfuellt, keine Blocker.
