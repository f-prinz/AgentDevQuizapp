# Tech-Stack-Entscheidung

Status: **FREIGEGEBEN** (Nutzerfreigabe 2026-10-26: Komponenten `server` + `web`, Stacks wie unten; `contracts`-Format wie unten vorgeschlagen).

## Komponenten

Das Projekt besteht aus mehreren Anwendungsteilen (Komponenten) mit jeweils eigenem Stack und eigenem Verzeichnis. Konvention: `apps/<komponente>/`; Schnittstellen-Artefakte liegen in `contracts/`.

| Komponente | Verzeichnis | Zweck | Status |
|---|---|---|---|
| contracts | contracts/ | Schnittstellen-Artefakte (WS-Events, REST-Schemas, geteilte Typen, Versionierung) | FREIGEGEBEN |
| <!-- <name> | apps/<name>/ | <zweck> | OFFEN --> |
| web | apps/web/ | Frontend: Ansichten fuer Spieler, Host und Projektor (Mobile First) | FREIGEGEBEN |
| server | apps/server/ | Backend: Lobby-/Spielverwaltung, Echtzeit-Events, Persistenz, Spielinhalte | FREIGEGEBEN |

Jede neue Komponente wird ueber `node scripts/add-component.mjs <name> --purpose "<text>"` angelegt (legt Agenten-Paar aus `docs/templates/` an, registriert sie in `.codex/config.toml`, ergaenzt `tasks/state.json.components`, Matrix- und `docs/agent-context.md`-Zeile sowie `apps/<name>/`). Konsistenz prueft `node scripts/verify.mjs`.

## Stack je Komponente

<!-- Pro Komponente einen Abschnitt nach diesem Muster:

### <komponente>

| Bereich | Aktueller Stack | Freigegebenes Ziel |
| --- | --- | --- |
| Runtime/Sprache | | |
| Framework | | |
| Kommunikation | | |
| Persistenz | | |
| Tests | | |
| Lint/Statik-Analyse | | |

Status: OFFEN | FREIGEGEBEN

`Lint/Statik-Analyse` ist optional: Bleibt die Zeile leer, entfaellt der
Lint-Schritt fuer diese Komponente; ist sie gefuellt, wird Lint-Evidence zum
harten DONE-Kriterium.
-->

### server

| Bereich | Aktueller Stack | Freigegebenes Ziel |
| --- | --- | --- |
| Runtime/Sprache | Node.js >=24, TypeScript, ESM (TypeScript 5.9.3) | Node.js (>=24, TypeScript, ESM) |
| Framework | Fastify 5 (HTTP) + `ws` 8 (WebSocket) | Fastify (HTTP) + `ws` (WebSocket) — Alternative: Socket.IO |
| Kommunikation | REST fuer Health/Lobby-Erstellung/Spielerbeitritt und WebSocket fuer Authentifizierung, Lobbystart, Spielernamen und Zeitabgleich; Spielzustandsbefehle sind noch nicht umgesetzt | WebSocket (Lobby-/Spiel-Events) + REST (Lobby-Setup, Health) |
| Persistenz | PostgreSQL via `pg` mit SQL-Migration und Seeds fuer den Spielkatalog; Lobbysitzungen und Spielzustand liegen in-memory | PostgreSQL via `pg` + SQL-Migrationen — Alternative: Prisma/Drizzle |
| Tests | Vitest 5 (Unit/Integration; PostgreSQL-Tests vorhanden) | Vitest (Unit + Integration, in-memory WS) |
| Lint/Statik-Analyse | ESLint 10 + `tsc --noEmit` | ESLint + `tsc --noEmit` |

Status: FREIGEGEBEN (2026-10-26, Entscheid: `ws` statt Socket.IO,
`pg` + SQL-Migrationen statt ORM).

Begruendung: Echtzeit-Mehrspieler mit 3 Rollen und synchronisierten Timern
braucht Push-Kommunikation — WebSocket ist die naheliegende Wahl;
PostgreSQL deckt die persistenten Spielinhalte (Katalog/Seed) ab und
entspricht der Nutzerangabe in `Raccoons-Quiz.md`. Lobbysitzungen werden
gemaess Entscheidung O6 nur in-memory gehalten.

### web

| Bereich | Aktueller Stack | Freigegebenes Ziel |
| --- | --- | --- |
| Runtime/Sprache | Node.js >=24, TypeScript, ESM (TypeScript 6.0.3) | TypeScript, ESM |
| Framework | React 19 + Vite 8 + react-router 8 | React (Vite) + react-router |
| Kommunikation | Vite-Entwicklungsserver mit REST-/WebSocket-Proxy-Konfiguration; native WebSocket- und REST-Clients fuer Lobbyfunktionen sind noch nicht umgesetzt | nativer WebSocket-Client gegen `server` (+ REST fuer Lobby-Setup) |
| Persistenz | Keine; Session-Verwaltung und localStorage-Reconnect sind noch nicht umgesetzt | keine (Session-Token im localStorage fuer Reconnect) |
| Tests | Vitest 5 + React Testing Library 16 in jsdom 30 | Vitest + React Testing Library; Drag-and-Drop/Timer via jsdom |
| Lint/Statik-Analyse | ESLint 10 + `tsc --noEmit` | ESLint + `tsc --noEmit` |

Status: FREIGEGEBEN (2026-10-26).

Begruendung: React entspricht der Nutzerangabe ("Frontend moeglichst
reactJS"); Vite liefert lokalen Dev-Server + Build ohne zusaetzliche
Infrastruktur. Tailwind/shadcn bewusst NICHT vorgeschlagen: die UI hat ein
festes, schlankes Farbsystem — CSS Custom Properties reichen.

### contracts

Schnittstellenartefakte werden versioniert und sind die einzige verbindliche Kopplungsstelle zwischen Komponenten. Format und Versionsregeln werden mit der ersten Komponenten-Schnittstelle festgelegt.

Format (freigegeben 2026-10-26): TypeScript-Typen/`zod`-Schemas, die
sowohl `server` validiert als auch `web` typisiert, ein Schema je
Event-Familie (`lobby`, `game`, `timer`); Dateien
`contracts/<familie>.schema.ts` + `contracts/README.md` mit
Versionsregeln (additive Aenderungen frei, Breaking nur mit CONTRACT_CHANGE-Task).

Ist-Stand: `contracts` ist als TypeScript-/`zod`-Paket mit Protokollversion 1
implementiert. TypeScript-Versionen unterscheiden sich in den Paketmanifests:
server 5.9.3, web 6.0.3 und contracts 7.0.2.

## Implementierungsstand

Die Angaben in "Aktueller Stack" beschreiben den vorhandenen Code. Die
Webanwendung besteht derzeit aus Routing, Layout und Platzhalterseiten; ein
Lobby-Client mit nativer WebSocket-Verbindung, REST-Aufrufen und
Session-Speicherung ist noch nicht implementiert (FEAT-2 und FEAT-15 stehen
noch aus). Serverseitige REST-/WebSocket-Lobbyfunktionen und der persistente
Spielkatalog sind vorhanden, weitergehende Spielzustandsfunktionen noch nicht.

Die in TECH-2 festgehaltene Browserabnahme ist BLOCKED, weil in der Umgebung
keine Browseranbindung verfuegbar war. Es gibt daher keine Aussage ueber eine
erfolgreiche manuelle UI-Pruefung im Browser.

## Geltungsbereich und Migration

- Eine freigegebene Zielarchitektur ist der architektonische Nordstern, aber keine automatische Umbauanweisung für bestehenden Code.
- Bei einem Greenfield gibt es noch keinen bestehenden Stack: Der erste freigegebene Stack einer Komponente gilt ab Scaffolding automatisch als ihr "Aktueller Stack"; `CURRENT_STACK_ONLY` bezieht sich auf alle Aenderungen danach.
- **Stack-Vielfalt zwischen Komponenten ist intendiert.** Innerhalb einer Komponente ist Mischung unterschiedlicher Framework-, Kommunikations- oder Persistenzansaetze ohne freigegebenen Migrations-Task untersagt.
- Jeder relevante Change Request wird vor der technischen Planung **je betroffener Komponente** als `CURRENT_STACK_ONLY`, `TARGET_ALIGNED` oder `REQUIRES_MIGRATION` klassifiziert.
- Aenderungen an `contracts/` sind `CONTRACT_CHANGE`: eigener Task (Praefix `TECH-`), betrifft mindestens zwei Komponenten, Pflicht-Review durch `code_reviewer`, nie Beiläufigkeit in einem Feature-Task.
- Neue Runtime-, Framework-, Kommunikations-, Persistenz- oder Dependency-Entscheidungen außerhalb dieser Datei benötigen eine freigegebene Stack-Entscheidung.
- Neue Dependencies müssen reproduzierbar über die Lock-Datei der jeweiligen Komponente eingeführt werden und bleiben freigabepflichtig.

## Architecture Challenge und Nutzer-Gate

Der Software Architect soll den freigegebenen Stack kritisch prüfen, darf ihn aber nicht eigenmächtig ersetzen. Jede Stack-Bewertung endet mit einer expliziten Empfehlung:

- `KEEP`: Der freigegebene Stack passt; keine Abweichung.
- `ADJUST`: Eine begrenzte Änderung wird empfohlen; Nutzerentscheidung erforderlich.
- `REPLACE`: Der Stack wird als ungeeignet bewertet; Nutzerentscheidung erforderlich.
- `BLOCKED - USER DECISION REQUIRED`: Planung oder Umsetzung darf erst nach Entscheidung fortgesetzt werden.

Alternativen müssen Nutzen, Risiken, Komplexität, Migrationsaufwand, Testbarkeit, Sicherheitsfolgen und Auswirkungen auf das spätere Deployment begründen. Eine vom Nutzer abgelehnte Alternative wird nicht erneut vorgeschlagen, solange sich Anforderungen oder Rahmenbedingungen nicht geändert haben.

## Verantwortlichkeiten der Agents

- Der Orchestrator stellt sicher, dass diese Datei bei Requirements-, Architektur-, Planungs-, Implementierungs- und Reviewaufträgen berücksichtigt wird und benennt je Delegation Komponente und freigegebenen Stack.
- Requirements Agents erfassen Stack-Annahmen und Konflikte als nichtfunktionale Anforderungen oder offene Entscheidungen.
- Der Software Architect dokumentiert die Stack-Bewertung je Komponente und markiert erforderliche Nutzerentscheidungen.
- Der Technical Planner plant ausschließlich gegen den zuletzt freigegebenen Stack der betroffenen Komponente; bei ausstehender Stackentscheidung bleibt die Planung blockiert.
- Komponenten-Developer und Komponenten-Test-Agents arbeiten nur im Verzeichnis und mit dem Stack ihrer Komponente; `contracts/` und fremde Komponenten sind tabu.
- `integration_engineer` besitzt die Vertragskohaerenz ueber Komponentengrenzen hinweg.
- Code Reviewer und Security Reviewer behandeln nicht freigegebene Stack-Abweichungen, Dependency-Änderungen und ungeplante `CONTRACT_CHANGE`s als Blocker.
- Der Documentation Agent beschreibt den tatsächlich implementierten Stack je Komponente getrennt von der Zielarchitektur.

Kein Punkt dieses Dokuments erlaubt ein Deployment, einen Push oder die Einführung produktiver Dienste.
