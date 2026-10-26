# Funktionsinventar

<!-- Generiert aus tasks/inventory.json via node scripts/render-inventory.mjs. Nicht von Hand editieren. -->

| ID | Faehigkeit | Komponente | Status | Nachweise | Eingefuehrt | Entfernt |
|---|---|---|---|---|---|---|
| INV-1 | Lokalen Serverzustand via GET /health abfragen | server | aktiv | route: `GET /health` in `apps/server/src/app.ts`<br>test: `apps/server/test/app.test.ts`<br>file: `apps/server/scripts/smoke.ts` | TECH-1 | - |
| INV-2 | Validierten Spielekatalog aus PostgreSQL vor Serverstart laden | server | aktiv | file: `apps/server/src/catalog.ts`<br>file: `apps/server/src/bootstrap.ts`<br>test: `apps/server/test/catalog.test.ts`<br>test: `apps/server/test/bootstrap.test.ts` | TECH-4 | - |

Stand: 2026-10-26T14:31:08.835Z
