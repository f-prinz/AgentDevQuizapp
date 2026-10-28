# Review CHG-9 — Initiales Seeding des Katalogs entfernen

Reviewer: code_reviewer (nicht implemented_by server_developer)
Diff-Basis: Branch CHG-9 gegen main.

## Akzeptanzkriterien

- [x] Seed-Dateien (`apps/server/seeds/*.json`), Seed-Lade- und Upsert-Pfad (`loadSeedGames`, `applySeeds`, `defaultSeedDirectory`, `validateUniqueIds`, `seedDirectory`-Option) entfernt; `initializeCatalog(pool)` fuehrt nur noch Migrationen aus und liest den Katalog.
- [x] Katalog startet bei frischer DB leer; Befuellung nur noch ueber Migrations-Schema + Admin-API (`POST/DELETE /games`, FEAT-16).
- [x] `Dockerfile` kopiert `apps/server/seeds` nicht mehr ins Runtime-Image.
- [x] `AdminPage.tsx` Hinweistext verweist nicht mehr auf „Seed-Datei".

## Prüfpunkte

- **Stack**: keine neuen Dependencies, keine Framework-Aenderung — reine Entfernung plus Test-Rewrite (`CURRENT_STACK_ONLY`).
- **API/Verhalten**: `POST /lobbies`, `/games`, WS-Flow unveraendert; `catalog`-Dekoration liefert `[]` bei leerer DB statt Seed-Tripel. INV-2 bleibt `active` (Katalog-Laden aus PostgreSQL besteht weiter — Anmerkung zu Seed-Upserts in `notes` angepasst).
- **Kein Datenverlust-Risiko im Betrieb**: bestehende `games`-Zeilen werden nicht geloescht — lediglich der Start-Upsert entfaellt; Fremdeintraege bleiben erhalten (Regressionstest: „applies migrations idempotently and preserves existing catalog rows").
- **`GameSeed`-Typ** bewusst nicht umbenannt (Nutzerentscheidung: kosmetischer Rename als separater CONTRACT_CHANGE moeglich, kein Blocker).
- **Test-Rewrite** `catalog.test.ts`: Seed-Fixtures durch Inline-Fixtures (`quizGame`, `estimationGame`) ersetzt; verwaiste Seed-Tests (duplikatsfreie IDs, Upsert-Teil-Commits) entfallen, da der Upsert-Pfad komplett weg ist. `bootstrap.test.ts` erwartet jetzt explizit leeren Katalog.

## Befunde

- Keine Blocker.
- Docker-Build weiterhin nur statisch geprueft (kein lokaler Docker-Daemon) — letzter Render-Deploy mit identischem Build-Pfad war erfolgreich; Seeds-COPY entfernt sicherheitlich unkritisch (Dateien existieren nicht mehr im Kontext).
- `apps/server/seeds/` Verzeichnis via `git rm` geloescht; `.gitignore`-Eintrag nicht vorhanden/noetig.

## Evidence

- Rot (TDD): `tasks/evidence/CHG-9-2026-10-28T15-05-52-771Z.json` (exit 1 — `bootstrap.test.ts` erwartete `[]`, bekam Seed-Tripel)
- Gruen: `tasks/evidence/CHG-9-2026-10-28T15-07-29-357Z.json` (exit 0, 78/78)
- Lint: `tasks/evidence/CHG-9-2026-10-28T15-08-11-288Z.json` (exit 0)

## Ergebnis

APPROVED — alle Akzeptanzkriterien erfuellt, keine Blocker.
