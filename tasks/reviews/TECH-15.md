# Review TECH-15 — Railway-Vorbereitung: Static-Serving, Remote-DB-Flag, Dockerfile

Reviewer: code_reviewer (nicht implemented_by server_developer)
Diff-Basis: Branch TECH-15 gegen main.

## Akzeptanzkriterien

- [x] `STATIC_DIR` gesetzt → `@fastify/static` liefert `apps/web/dist` aus; SPA-Fallback (`index.html` bei `GET` + `Accept: text/html` + Pfad ausserhalb `/api`), JSON-404 sonst.
- [x] `/api`-Praefix serverseitig: alle HTTP-Routen laufen als Plugin doppelt (unprefixed + `/api`); Dev-Proxy-Verhalten wird serverseitig abgebildet, lokale Tests bleiben unprefixed moeglich.
- [x] `DATABASE_ALLOW_REMOTE=true` → `validateDatabaseUrl` akzeptiert Remote-Hosts; ohne Flag weiterhin nur localhost (Sicherheits-Default bleibt).
- [x] `Dockerfile` + `.dockerignore` im Root: Multi-Stage `node:24-slim`, baut contracts → web → server, Runtime nur Prod-Deps + dist/seeds/migrations/web-dist, `CMD node apps/server/dist/main.js`.
- [x] `.env.example` dokumentiert `STATIC_DIR` und `DATABASE_ALLOW_REMOTE`; README-Abschnitt „Hosting (Docker/Railway)" listet alle Pflicht-Variablen.
- [x] Lokale Dev-Pfade unveraendert: ohne `STATIC_DIR`/`DATABASE_ALLOW_REMOTE` identisches Verhalten.

## Prüfpunkte

- **Stack**: bestehender Fastify/TS-Stack; einzige neue Dependency `@fastify/static` ^10.1.8 — im Task via `allows_dep_change` freigegeben, package-lock aktualisiert.
- **Sicherheit**: Remote-DB-Opt-in explizit (Default lehnt fremde Hosts weiter ab — beugt Fehlkonfiguration vor); SPA-Fallback liefert nur `index.html`, keine Pfad-Traversal-Oeffnung; `/api/*` bleibt JSON-404.
- **Plugin-Registrierung**: Fastify-`register` mit `prefix: '/api'` — dokumentiertes Muster, keine URL-Rewrite-Hacks; Closures (`registry`, `catalogStore`, `isAuthorized`) greifen korrekt in beiden Kontexten.
- **Tests**: `static-serving.test.ts` (Prefix-Strip, dual unprefixed, Static-Assets, SPA-Fallback, JSON-404 ohne staticDir), `bootstrap.test.ts` (Remote-URL mit/ohne Flag, ungueltige URL).

## Befunde

- Keine Blocker.
- **Offen**: Dockerfile konnte lokal nicht gebaut werden (kein Docker installiert) — statisch geprueft; erster echter Build erfolgt auf Railway oder lokal mit Docker. `npm ci --omit=dev` pro Paket ohne npm-Workspaces ist korrekt fuer die file:-Dep-Aufloesung (`@raccoons/contracts` symlink auf `../contracts`).
- Kleinigkeit: `/api`-Doppelregistrierung erzeugt keine Kollisionen (eigenes Plugin-Scope, eigene Route-Instanzen); langfristig koennte der Web-Code auf unprefixed Pfade umgestellt und der Prefix entfernt werden — kein Handlungsbedarf.

## Evidence

- Server-Tests: `tasks/evidence/TECH-15-2026-10-28T10-34-47-424Z.json` (exit 0, 79/79)
- Server-Lint: `tasks/evidence/TECH-15-2026-10-28T10-35-47-574Z.json` (exit 0)
- Kein `red_evidence` erforderlich (`red_evidence_required: false`).

## Ergebnis

APPROVED — alle Akzeptanzkriterien erfuellt; einziger offener Punkt ist der nicht lokal ausfuehrbare Docker-Build (auf der Zielplattform zu verifizieren).
