# Validierung: Lobby und Reconnect (TECH-7)

Datum: 2026-10-27 · Task: TECH-7 · Komponente: server

## Nachgewiesene Faehigkeiten

Alle Nachweise laufen gegen den echten Fastify-Server mit echten
HTTP- und WebSocket-Verbindungen (`apps/server/test/e2e/lobby.test.ts`,
4/4 Tests, Evidence `tasks/evidence/TECH-7-2026-10-27T10-09-19-089Z.json`).

- **Vollstaendiger Ablauf** — Lobby via `POST /lobbies`, zwei Spieler via
  `POST /lobbies/:id/players`, Host + Projektor + beide Spieler authentifiziert
  per WS. Ablauf `lobby.start` → `game.select` → `game.prepare` → `game.start`
  → `answer.submit` (2 Spieler) → `game.reveal` → `game.finish` bis zur
  Uebersicht mit `played`-Katalog, Ranking und `rankingTransition`.
- **Unbefugte Moderation abgewiesen** — `lobby.start` und `game.select` eines
  Spielers werden mit `UNAUTHORIZED`/`FORBIDDEN` abgelehnt.
- **Refresh ohne Duplikat** — Reauth derselben Sitzung stellt `playerId` und
  Rolle wieder her, ohne neuen Teilnehmer (Host-Snapshot: weiter 1 Teilnehmer).
- **Spaeter Beitritt wartet** — Spieler, der waehrend `playing` beitritt,
  erhaelt `participating: false` und `waiting: true`.

## Browserbelege

Bereits erbracht in FEAT-2/FEAT-4 (Browserabnahme dokumentiert in
`tasks/reviews/FEAT-2.md` und Inventar-Anker `INV-12`/`INV-14`):
Lobby anlegen, Host-Link-Fragment-Cleanup + Refresh, Spielerbeitritt mit
Live-Teilnehmerliste, Projektorroute, Phasen/Timer im Browser.

## Scope-Audit

Diff dieses Tasks umfasst ausschliesslich `apps/server/test/e2e/lobby.test.ts`,
`docs/validation/lobby.md` und `tasks/evidence/` — innerhalb
`allowed_paths` (`apps/server/`, `docs/validation/lobby.md`). Kein
produktiver Code geaendert (reiner Validierungstask). Bestehende Inventar-
Eintraege INV-3/4/5/6/7/9 decken die nachgewiesenen Faehigkeiten ab; kein
neuer Eintrag noetig.
