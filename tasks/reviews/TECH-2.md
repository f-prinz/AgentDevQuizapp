# Review TECH-2

Reviewer: code_reviewer (unabhaengig von web_developer)
Gepruefter Stand: e4d673d6b4a8404a3f0f5045ca2794528cb7248e zuzueglich der nachgeprueften einzeiligen Smoke-URL-Korrektur im Arbeitsbaum und HTTP-Evidence von 14:16:15. Erstpruefung des vollstaendigen main...TECH-2-Diffs auf ad27335861158d67d56b1051555d24859ff62555 einschliesslich Lockfile; Nachpruefung des vollstaendigen Diffs ad273358...HEAD einschliesslich CSS-Fix, Regressionstest, HTTP-Probe und neuer Evidence.
Ergebnis: Codefreigabe ohne offene Code-Findings; urspruenglicher Code-Blocker und Minor-Finding behoben. Keine Stackabweichung festgestellt. Browservalidierung bleibt ein separater Umgebungsblocker fuer DONE.

## Findings

Keine offenen Code-Findings.

Behobener Blocker: Die Projektor-Spalten waren auf app.css:27 nur oberhalb von 64rem aktiv. Auf dem nachgeprueften Stand setzt app.css:19 eine Projektor-Mindestbreite von 64rem und app.css:21 die zwei Grid-Spalten unabhaengig vom Breakpoint. Host-/Spielerregeln bleiben schmal. Damit ist die Desktop-Invariante im Code erfuellt.

Behobenes Minor-Finding: `apps/web/scripts/smoke.mjs:4` pruefte drei nicht registrierte URLs. Die Nachkorrektur verwendet exakt `/`, `/lobbies/smoke/host`, `/join`, `/player` und `/projector`; diese entsprechen den aktuellen Scaffold-Routen. Der Hinweis auf eine reine HTTP-Startpruefung bleibt bestehen. Vollstaendige spaetere Lobby-/Vertragslink-Funktionalitaet wird dadurch nicht behauptet.

## Kriterienabgleich und Invarianten

- Task-AK `npm test, lint und build laufen gruen`: Evidence der Erstpruefung sowie aktuelle `TECH-2-2026-10-26T14-10-52-898Z.json` (neun Tests), `TECH-2-2026-10-26T14-11-04-257Z.json` (ESLint + Typecheck) und `TECH-2-2026-10-26T14-11-12-960Z.json` (Build) vollstaendig gelesen; aktuelle Nachweise alle Exit 0. Tests und Build wurden in diesem Review nicht erneut ausgefuehrt. Lint wurde in beiden Reviewrunden unabhaengig erneut ausgefuehrt, jeweils Exit 0.
- Regression: `src/projector-layout.test.tsx` laedt die tatsaechlichen Theme-/App-CSS-Dateien und prueft mit jsdom und gesetztem `innerWidth=480` Mindestbreite sowie Grid-Spaltendeklaration des Projektors; Host-/Spielerhuellen erhalten keine Desktop-Mindestbreite. Rote Evidence `TECH-2-2026-10-26T14-01-01-324Z.json` scheitert am fehlenden 1024px-Minimum; gruene aktuelle Evidence enthaelt alle neun Tests. Dies ist eine CSS-Deklarationspruefung, keine Browser-Layoutmessung.
- Task-AK `Dev-Server startet lokal`: HTTP-Evidence `TECH-2-2026-10-26T13-57-56-637Z.json` und nach der URL-Korrektur `TECH-2-2026-10-26T14-16-15-483Z.json` fuehren `node apps/web/scripts/smoke.mjs` aus, jeweils Exit 0; sie belegen einen antwortenden Vite-Devserver mit HTML-Einstiegsdokument. Fruehere Evidence `TECH-2-2026-10-26T13-57-27-548Z.json` dokumentiert korrekt ECONNREFUSED bei gestopptem Server, Exit 1. Der nachfolgende Start ist durch den Orchestrator gemeldet (Session 97821 auf localhost:5173). Die Probe beweist keine React-Routenaufloesung oder Browserdarstellung.
- Freigegebener Stack: React/Vite/TypeScript ESM, react-router, Vitest/RTL/jsdom, ESLint + tsc; keine weiteren UI-, Kommunikations- oder Persistenzframeworks. Lokale Kopplung ausschliesslich ueber die freigegebene `file:../../contracts`-Dependency. Dependency-Aenderungen sind fuer TECH-2 erlaubt und die Installation wurde vom Nutzer freigegeben. Lockfile bindet direkte Versionen und transitive Aufloesungen; TypeScript 6.0.3 liegt innerhalb der gelockten typescript-eslint-Peergrenze `<6.1.0`.
- Theme: genau die vier vorgeschriebenen Farb-Rohwerte, zentral in `src/styles/theme.css`; sonst ausschliesslich Custom Properties. Host/Spieler beginnen mit schmalem Layout und erhalten erst bei breiteren Viewports Erweiterungen. Projektor verbleibt nach dem Fix im Desktop-Layout.
- Routen: getrennte Rollenplatzhalter, Host-ID wird als React-Text ausgegeben. Keine `innerHTML`-Nutzung, Secrets, Sessionpersistenz, Autoritaets-/Timerlogik oder Datenzugriffe auf andere Komponenten im Diff. `/api`-Proxy und SPA-Route `/lobbies/:lobbyId/host` sind getrennt; `/ws` nutzt den WebSocket-Proxy.
- Duplikationsabgleich: `docs/feature-inventory.md` gelesen, Inventartabelle derzeit leer. Keine vorhandene Faehigkeit wird dupliziert. Die Seiten benennen ihre Funktionen ausdruecklich als spaeter zu ergaenzende Platzhalter; kein Lobby-/Spiel-Feature als implementiert gewertet.
- Scope: Diff besteht ausschliesslich aus `apps/web/` und `tasks/evidence/`. Kein contracts/-Artefakt oder Buchhaltungs-State geaendert. Vorhandene Scope-Evidence `TECH-2-2026-10-26T13-55-16-530Z.json` hat Exit 0.

## Ausgefuehrte Befehle

| Befehl | Ergebnis |
|---|---|
| `Get-Content` fuer AGENTS.md, docs/agent-context.md und docs/tech-stack.md | Verbindliche Regeln und Komponenten-Invarianten gelesen. |
| `Get-Content` fuer Projektidee, Funktionsinventar und Tech-Playbook; `node -e` zum Lesen von TECH-2 aus tasks/state.json | Task-AK, Freigaben und Inventar abgeglichen. |
| `git status --short --branch`, `git diff --stat main...TECH-2`, `git rev-parse HEAD` | Branch TECH-2 sauber; gepruefter Commit siehe oben, 18 Diff-Dateien. |
| `git diff main...TECH-2 -- . ':!apps/web/package-lock.json'` sowie `Get-Content` des vollstaendigen Lockfiles in Abschnitten | Gesamter Diff gelesen; Quellcode, Konfiguration, Dependencies und Evidence geprueft. |
| `rg --files apps/web contracts docs` und `rg -n -C 3` in Plan, Architektur und Vertrags-README | Vorhandene Struktur und TECH-2-Abgrenzung geprueft. |
| `npm --prefix apps/web run lint` | Exit 0; ESLint und `tsc --noEmit` ohne Findings. |
| `git diff ad27335861158d67d56b1051555d24859ff62555...HEAD`, `git status --short --branch`, `git rev-parse HEAD`, `Get-Content tasks/reviews/TECH-2.md` | Nachpruefungs-Diff vollstaendig gelesen; Stand e4d673d; ausschliesslich eigener ungetrackter Reviewbericht. |
| `npm --prefix apps/web run lint` (Nachpruefung) | Exit 0; CSS-Fix, Regressionstest und HTTP-Probe ohne Lint-/Typecheck-Findings. |
| `git diff HEAD -- apps/web/scripts/smoke.mjs`, `Get-Content` von Smoke-Skript und HTTP-Evidence 14:16:15, `git rev-parse HEAD` | Einzeilige URL-Korrektur vollstaendig gelesen und gegen die registrierten Scaffold-Routen abgeglichen; neue HTTP-Evidence Exit 0. |
| `npm --prefix apps/web run lint` (nach URL-Korrektur) | Exit 0; ESLint und Typecheck weiterhin ohne Findings. |

## Offene Validierung

Fehlerklasse umgebung: Die Browserpruefung nach `docs/agent-context.md` ist laut Orchestrator blockiert: CUA liefert keine Browser-/App-Oberflaechen; Chrome und IAB lassen sich dort nicht erstellen. Diese Information stammt vom Orchestrator; der Reviewer hat die Browserwerkzeuge nicht erneut aufgerufen. jsdom-Tests und ein HTTP-Startprobe ersetzen keine visuelle oder interaktive Browserabnahme. Browsernachweis offen halten und nach Verfuegbarkeit nachholen.

Geaenderte Dateien durch den Reviewer: ausschliesslich `tasks/reviews/TECH-2.md`. Keine Implementierungs-, Vertrags- oder State-Aenderung. Kein aktiver Code-Blocker; Browsernachweis vor DONE weiterhin erforderlich.
