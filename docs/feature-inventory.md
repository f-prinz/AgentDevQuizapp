# Funktionsinventar

<!-- Generiert aus tasks/inventory.json via node scripts/render-inventory.mjs. Nicht von Hand editieren. -->

| ID | Faehigkeit | Komponente | Status | Nachweise | Eingefuehrt | Entfernt |
|---|---|---|---|---|---|---|
| INV-1 | Lokalen Serverzustand via GET /health abfragen | server | aktiv | route: `GET /health` in `apps/server/src/app.ts`<br>test: `apps/server/test/app.test.ts`<br>file: `apps/server/scripts/smoke.ts` | TECH-1 | - |
| INV-2 | Validierten Spielekatalog aus PostgreSQL vor Serverstart laden | server | aktiv | file: `apps/server/src/catalog.ts`<br>file: `apps/server/src/bootstrap.ts`<br>test: `apps/server/test/catalog.test.ts`<br>test: `apps/server/test/bootstrap.test.ts` | TECH-4 | - |
| INV-3 | Lobby mit getrennten Rollenlinks und Sitzungen erstellen | server | aktiv | route: `POST /lobbies` in `apps/server/src/app.ts`<br>test: `apps/server/test/lobby.test.ts` | FEAT-1 | - |
| INV-4 | Spieler mit Namen beitreten und Teilnehmer live aktualisieren | server | aktiv | route: `POST /lobbies/:lobbyId/players` in `apps/server/src/app.ts`<br>test: `apps/server/test/lobby.test.ts` | FEAT-1 | - |
| INV-5 | Lobby autorisiert ab zwei Spielern starten | server | aktiv | file: `apps/server/src/lobby.ts`<br>test: `apps/server/test/lobby.test.ts` | FEAT-1 | - |
| INV-6 | Lobbysitzung nach Verbindungsverlust ohne Doppelbeitritt fortsetzen | server | aktiv | file: `apps/server/src/app.ts`<br>test: `apps/server/test/reconnect.test.ts` | FEAT-13 | - |

Stand: 2026-10-26T15:33:08.370Z
