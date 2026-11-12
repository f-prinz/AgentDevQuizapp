# Funktionsinventar

<!-- Generiert aus tasks/inventory.json via node scripts/render-inventory.mjs. Nicht von Hand editieren. -->

| ID | Faehigkeit | Komponente | Status | Nachweise | Eingefuehrt | Entfernt |
|---|---|---|---|---|---|---|
| INV-1 | Lokalen Serverzustand via GET /health abfragen | server | aktiv | route: `GET /health` in `apps/server/src/app.ts`<br>test: `apps/server/test/app.test.ts`<br>file: `apps/server/scripts/smoke.ts` | TECH-1 | - |
| INV-10 | Sortierbegriffe nach Wert ordnen und Punkte je Position werten | server | aktiv | file: `apps/server/src/game.ts`<br>test: `apps/server/test/game-state.test.ts` | FEAT-9 | - |
| INV-11 | Schaetzergebnisse nach Ranggruppen und Gleichstaenden werten | server | aktiv | file: `apps/server/src/game.ts`<br>test: `apps/server/test/game-state.test.ts` | FEAT-11 | - |
| INV-12 | Lobby im Web anlegen, per Rollenlink beitreten und Live-Teilnehmer in der Host-Lobbyansicht sehen | web | aktiv | test: `apps/web/src/lobby-views.test.tsx`<br>file: `apps/web/src/routes/Pages.tsx`<br>file: `apps/web/src/app-routes.tsx`<br>ui_step: `Browser: Lobby anlegen; Host-Link öffnen und refreshen; Spieler Ada beitreten lassen; Host-Teilnehmerliste und Projektorroute prüfen` | FEAT-2 | - |
| INV-13 | Lobby-Sitzungen im Web wiederaufnehmen und veraltete Sitzungen nach Serverneustart erkennen | web | aktiv | test: `apps/web/src/lobby-views.test.tsx`<br>file: `apps/web/src/routes/Pages.tsx` | FEAT-15 | - |
| INV-14 | Rollenbasierte Spielphasen, Timer, Eingabestatus und Host-Steuerung im Web | web | aktiv | test: `apps/web/src/game-views.test.tsx`<br>file: `apps/web/src/GameViews.tsx`<br>file: `apps/web/src/routes/Pages.tsx` | FEAT-4 | - |
| INV-15 | Spieler-Statusleiste (Name/Punkte/Platzierung) | web | aktiv | ui_step: `PlayerPage: oberhalb der Card steht '.player-identity' (h2) im Format 'Name - <Podium> Platz <Star> Punkte' (Icons seit CHG-16)` | FEAT-14 | - |
| INV-16 | Quiz im Web spielen und Aufloesung mit markierter Antwort sehen | web | aktiv | test: `apps/web/src/game-views.test.tsx`<br>file: `apps/web/src/GameViews.tsx` | FEAT-8 | - |
| INV-17 | Uebersicht mit Spielekatalog, Host-Auswahl/-Start und Projektor-Ranking mit Animationsuebergang | web | aktiv | test: `apps/web/src/overview-views.test.tsx`<br>file: `apps/web/src/GameViews.tsx`<br>file: `apps/web/src/styles/app.css`<br>file: `apps/web/src/projector/RankingBoard.tsx`<br>file: `apps/web/src/projector/ranking-logic.ts` | FEAT-6 | - |
| INV-18 | Sortieren im Web per Drag-and-Drop loesen und Auswertung mit Werten/Fehlern sehen | web | aktiv | test: `apps/web/src/game-views.test.tsx`<br>file: `apps/web/src/GameViews.tsx`<br>file: `apps/web/src/styles/app.css` | FEAT-10 | - |
| INV-19 | Schaetzen im Web eingeben und Auswertung mit eigener Eingabe, Abstand und Rangliste sehen | web | aktiv | test: `apps/web/src/game-views.test.tsx`<br>file: `apps/web/src/GameViews.tsx` | FEAT-12 | - |
| INV-2 | Validierten Spielekatalog aus PostgreSQL vor Serverstart laden | server | aktiv | file: `apps/server/src/catalog.ts`<br>file: `apps/server/src/bootstrap.ts`<br>test: `apps/server/test/catalog.test.ts`<br>test: `apps/server/test/bootstrap.test.ts` | TECH-4 | - |
| INV-20 | Rollen-Beitrittslinks im Host- und Projektor-Snapshot bereitstellen | server | aktiv | file: `contracts/lobby.schema.ts`<br>file: `apps/server/src/lobby.ts`<br>test: `apps/server/test/lobby.test.ts` | TECH-14 | - |
| INV-21 | Host teilt Beitritts- und Projektorlink per Copy-Button; Projektor zeigt Beitrittslink und QR-Code in der Lobby | web | aktiv | test: `apps/web/src/lobby-views.test.tsx`<br>file: `apps/web/src/GameViews.tsx`<br>file: `apps/web/package.json` | CHG-2 | - |
| INV-22 | Spielekatalog zur Laufzeit per token-geschuetztem JSON-Upload erweitern und Spiele loeschen | server | aktiv | route: `GET /games` in `apps/server/src/app.ts`<br>route: `POST /games` in `apps/server/src/app.ts`<br>route: `DELETE /games/:gameId` in `apps/server/src/app.ts`<br>file: `apps/server/src/catalog-admin.ts`<br>test: `apps/server/test/catalog-admin.test.ts` | FEAT-16 | - |
| INV-23 | Spielekatalog im Browser verwalten (Liste, JSON-Upload, Loeschen) | web | aktiv | file: `apps/web/src/app-routes.tsx`<br>file: `apps/web/src/routes/AdminPage.tsx`<br>test: `apps/web/src/admin-page.test.tsx` | FEAT-16 | - |
| INV-24 | Anwendung als ein Prozess hosten (API + WS + statisches Web-Build, Remote-Datenbank) | server | aktiv | file: `Dockerfile`<br>file: `apps/server/src/app.ts`<br>file: `apps/server/src/bootstrap.ts`<br>test: `apps/server/test/static-serving.test.ts` | TECH-15 | - |
| INV-25 | Dunkles Farbschema mit Akzentfarbe und Text-Hierarchie (Slate/Indigo) | web | aktiv | file: `apps/web/src/styles/theme.css`<br>file: `apps/web/src/styles/app.css` | CHG-10 | - |
| INV-26 | Light/Dark-Theme-Umschaltung per Icon-Button (Sonne/Mond) oben rechts auf allen Ansichten, persistiert in localStorage | web | entfernt | - | FEAT-17 | CHG-24 |
| INV-27 | Automatischer WebSocket-Reconnect: max. 3 Retries (Backoff 2s/5s/10s), Sofort-Check bei visibilitychange/online/pageshow, danach Fehler + Erneut-verbinden-Button; Fatal-Errors ohne Retry | web | aktiv | file: `apps/web/src/routes/Pages.tsx`<br>test: `apps/web/src/game-views.test.tsx` | FEAT-20 | - |
| INV-3 | Lobby mit getrennten Rollenlinks und Sitzungen erstellen | server | aktiv | route: `POST /lobbies` in `apps/server/src/app.ts`<br>test: `apps/server/test/lobby.test.ts` | FEAT-1 | - |
| INV-4 | Spieler mit Namen beitreten und Teilnehmer live aktualisieren | server | aktiv | route: `POST /lobbies/:lobbyId/players` in `apps/server/src/app.ts`<br>test: `apps/server/test/lobby.test.ts` | FEAT-1 | - |
| INV-5 | Lobby autorisiert ab zwei Spielern starten | server | aktiv | file: `apps/server/src/lobby.ts`<br>test: `apps/server/test/lobby.test.ts` | FEAT-1 | - |
| INV-6 | Lobbysitzung nach Verbindungsverlust ohne Doppelbeitritt fortsetzen | server | aktiv | file: `apps/server/src/app.ts`<br>test: `apps/server/test/reconnect.test.ts` | FEAT-13 | - |
| INV-7 | Serverseitige Spielrunde mit Rollen- und Fristkontrolle steuern | server | aktiv | file: `apps/server/src/game.ts`<br>test: `apps/server/test/game-state.test.ts` | FEAT-3 | - |
| INV-8 | Quizfragen einzeln mit einem Punkt je richtiger Antwort auswerten | server | aktiv | file: `apps/server/src/game.ts`<br>test: `apps/server/test/game-state.test.ts` | FEAT-7 | - |
| INV-9 | Abgeschlossene Quizpunkte als Ranking und Spielkatalogstatus bereitstellen | server | aktiv | file: `apps/server/src/game.ts`<br>file: `apps/server/src/lobby.ts`<br>test: `apps/server/test/game-state.test.ts` | FEAT-5 | - |

Stand: 2026-11-12T15:58:57.903Z
