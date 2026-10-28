# Review FEAT-16 — Spiel-Upload per JSON + Admin-UI, servergenerierte IDs, Token-Schutz, DELETE

Reviewer: code_reviewer (nicht implemented_by server_developer)
Diff-Basis: Branch FEAT-16 gegen main.

## Akzeptanzkriterien

- [x] `POST /games` akzeptiert GameSeed-artiges JSON ohne ids; Spiel- und alle inneren ids werden serverseitig als UUID generiert (`materializeGameDraft`, `crypto.randomUUID`).
- [x] Quiz: richtige Option per `correctOptionIndex` (0-basiert) oder `correctOptionId`-Verweis auf mitgelieferte Options-id; Verweis wird auf generierte UUID gemappt.
- [x] Validierung via `GameSeedSchema` nach der Materialisierung; ungültige Drafts → 400 `INVALID_MESSAGE`.
- [x] Persistenz in `games`-Tabelle (`insertGame`) und In-Memory-Katalog synchron (`catalogOf(...).push`), sofort in `GET /games` und `game.select` sichtbar.
- [x] `DELETE /games/:id` entfernt DB-Zeile (`deleteGame`, rowCount>0) und Katalogeintrag; unbekannte id → 404.
- [x] Beide schreibenden Endpunkte mit `Authorization: Bearer <ADMIN_TOKEN>`; Vergleich per `timingSafeEqual` bei gleicher Länge; fehlendes/falsches Token → 401 `UNAUTHORIZED`; ohne `ADMIN_TOKEN` oder ohne CatalogStore sind POST/DELETE nicht registriert (404).
- [x] `ADMIN_TOKEN` in `apps/server/.env.example` dokumentiert (leer = deaktiviert).
- [x] Admin-UI `/admin`: Token-Feld, Textarea + Datei-Picker, Upload-Button, Katalogliste mit Lösch-Buttons, Fehler-/Statusmeldungen.
- [x] README: Abschnitt „Spiele zum Katalog hinzufügen" dokumentiert Endpunkte, Token und Upload-Format.

## Prüfpunkte

- **Stack-Konformität**: Fastify-Routen im bestehenden `buildServer`-Muster (safeParse → errorResponse), React-Seite im Pages-Muster mit `/api`-Fetch; keine neuen Dependencies.
- **Stack-Grenzen**: Draft-Validierung in `catalog-admin.ts` nutzt `GameSeedSchema` aus `@raccoons/contracts` — keine CONTRACT_CHANGE nötig, keine Schema-Duplikation.
- **Sicherheit**: Token nie geloggt, nicht in UI persistiert (State only), `timingSafeEqual`, Fehler geben keine Details preis; GET /games gibt nur {id,kind,title,rules} aus.
- **Pool-Lifecycle**: `bootstrap.ts` hält den Pool offen (zuvor nach Init geschlossen) und beendet ihn per `onClose`-Hook; Startfehlerpfad schließt Pool weiterhin.
- **Tests**: `catalog-admin.test.ts` (Materialisierung + Routen inkl. 401/404/400/201/204), `catalog.test.ts` (insertGame/deleteGame auf ephemeral PG), `admin-page.test.tsx` (Liste, Upload mit Bearer, lokale JSON-Validierung, 401-Fehlerpfad, Delete).

## Befunde

- Keine Blocker.
- Kleinigkeit: `IdSchema` akzeptiert `^[A-Za-z0-9_-]+$` — UUIDs sind valide.
- Fehlende `correctOptionId`-Auflösung landet bewusst im Schema-Fehlerpfad (400) — Verhalten in Tests abgedeckt.

## Evidence

- Rot: `tasks/evidence/FEAT-16-2026-10-28T07-10-24-013Z.json` (exit 1)
- Server-Tests: `tasks/evidence/FEAT-16-2026-10-28T08-07-00-459Z.json` (exit 0, 73/73)
- Server-Lint: `tasks/evidence/FEAT-16-2026-10-28T08-13-57-157Z.json` (exit 0)
- Web-Tests: `tasks/evidence/FEAT-16-2026-10-28T08-16-43-648Z.json` (exit 0, 75/75)
- Web-Lint: `tasks/evidence/FEAT-16-2026-10-28T08-17-01-666Z.json` (exit 0)

## Ergebnis

APPROVED — alle Akzeptanzkriterien erfüllt, Tests und Lint grün, keine Blocker.
