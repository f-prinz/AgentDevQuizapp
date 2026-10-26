# MVP – priorisierter Umsetzungsplan

Stand: 2026-10-26. Anforderungen O1–O10 sind bestaetigt. Grundlage sind
`feature-mvp-requirements.md`, dessen adversariale Validierung und
`feature-mvp-architecture.md`. Die beiden Validatorfindings (sichtbare
Quizoptionen und fruehes Aufloesen) wurden laut Orchestrator korrigiert.
Dieser Plan wurde nicht als Implementierungs- oder Testnachweis erstellt.

## Stack und Grenzen

Server: Node >=24, TypeScript/ESM, Fastify, ws, pg/PostgreSQL und SQL-Migrationen,
Vitest, ESLint und tsc. Web: React/Vite/TypeScript, react-router, nativer
WebSocket, Vitest/RTL/jsdom, ESLint und tsc. Contracts: TypeScript/zod.
Bewertung fuer alle Bereiche KEEP; keine Stackabweichung, kein
REQUIRES_MIGRATION. Neue Dependencies brauchen Freigabe und Komponenten-Lockfile.

TECH-1/2 und der Erstvertrag TECH-3 sind TARGET_ALIGNED. Anschliessende
Produktarbeit ist CURRENT_STACK_ONLY. TECH-3 ist zusaetzlich CONTRACT_CHANGE,
betrifft server und web und wird durch integration_engineer umgesetzt.
Nach TECH-6 verwendet TECH-3 `component: contracts` als virtuelle
Artefakt-Komponente; sein Code-Scope ist ausschliesslich `contracts/`.
Es entstehen weder `apps/contracts/` noch weitere Komponenten-Agents.

Nur der Orchestrator schreibt Taskbuchhaltung auf main und fuehrt die unten
angegebenen Befehle aus. Dieser Plan aendert weder state.json noch den
generierten Backlog. Bestehende IDs werden erhalten.

## Reihenfolge und effektive Abhaengigkeiten

Die Tabelle benennt die nachzuschaerfenden Abhaengigkeiten vollstaendig; die
vorhandene state.json enthaelt teilweise nur eine Teilmenge. TECH-6 stellt die
dafuer fehlenden Metadatenoptionen bereit. Vor Arbeitsbeginn jedes Tasks muessen
seine Zeile und AK per Skript im State stehen. Prioritaet ist eine Reihenfolge,
keine Streichung von MVP-Faehigkeiten.

| Prioritaet | ID | Komponente / Klasse | Abhaengigkeiten | Abnahme je Item |
|---|---|---|---|---|
| P0 | TECH-5 | server als administrativer Owner / TARGET_ALIGNED | keine | Requirements F1–F9/O1–O10, adversariale Validierung, Architektur und dieser Plan konsistent; Dokumentreview. |
| P0 | TECH-6 | server als administrativer Owner / CURRENT_STACK_ONLY | keine | Sichere Metadatenpflege ueber Skripte, isolierte Tests, bestehende Workflowgates erhalten. |
| P0 | TECH-1 | server / TARGET_ALIGNED | TECH-5, TECH-3 | Komponenten-Scaffold mit lokaler Vertragsreferenz; test, lint, build; realer lokaler Health-Aufruf und sauberer Shutdown. |
| P0 | TECH-2 | web / TARGET_ALIGNED | TECH-5, TECH-3 | Komponenten-Scaffold mit lokaler Vertragsreferenz und zentralen Themevariablen; test, lint, build; real gestarteter Dev-Server. |
| P0 | TECH-3 | contracts / TARGET_ALIGNED + CONTRACT_CHANGE | TECH-5, TECH-6 | REST-/WS-Schemas fuer Lobby, Spiel, Timer, Host-Geheimlink, Auth/Resume und gefilterte Snapshots; Versionierung; gueltige/ungueltige Beispiele und Typecheck. |
| P0 | TECH-4 | server / CURRENT_STACK_ONLY | TECH-1, TECH-3 | SQL-Migrationen und idempotenter Seed aller drei Spielarten; echter PostgreSQL-Lese-/Neustart-/Fehlernachweis; keine Sitzungsdaten persistent. |
| P0 | FEAT-1 | server / CURRENT_STACK_ONLY | TECH-1, TECH-3 | Lobby/Links einschliesslich nicht erratbarem Host-Geheimlink, Rollenrechte, Namen, unbegrenzte Teilnehmer, Host kein Spieler, Start ab zwei; keine Hostrechte ueber Beitrittslink. |
| P0 | FEAT-2 | web / CURRENT_STACK_ONLY | TECH-2, TECH-3, FEAT-1 | Host erstellt Lobby, Links funktionieren, Name/Teilnehmerliste, mobile Host-/Spielerroute und Desktop-Projektorroute. |
| P0 | FEAT-13 | server / CURRENT_STACK_ONLY | FEAT-1 | Token-Resume identischer Rolle/Spieler-ID ohne Duplikat; gespeicherter Draft/Finalstatus; Neustart macht alte Sitzung ungueltig. |
| P0 | FEAT-15 | web / CURRENT_STACK_ONLY | FEAT-2, FEAT-13 | Sessionablage und Wiederbeitritt per Refresh/Link; klarer Fehler nach Serverneustart; keine neuen Teilnehmer bei Resume. |
| P0 | FEAT-3 | server / CURRENT_STACK_ONLY | FEAT-1, FEAT-13, TECH-4 | Hostzustandsmaschine, Teilnehmer je Spiel eingefroren, spaeter Beitritt wartet ganzes Spiel; Deadline+2s, Finalsperre, alle-final-Fruehschluss; keine Loesung vor Aufloesung. |
| P0 | FEAT-4 | web / CURRENT_STACK_ONLY | FEAT-2, FEAT-3, FEAT-15 | Phasen/Timer je Rolle, Startanimation, atomare Finalabgabe und Sperre, Aufloesen nach CLOSED auch bei Fruehschluss, Wartestatus neuer Spieler. |
| P0 | FEAT-7 | server / CURRENT_STACK_ONLY | FEAT-3 | Vier Optionen, eine richtige, 30s, letzte gueltige Auswahl; Einzelauswertung jeder Quizfrage; Host naechste Frage, Uebersicht erst am Quizende; Wertung genau einmal. |
| P0 | FEAT-8 | web / CURRENT_STACK_ONLY | FEAT-4, FEAT-7 | Vier waehlbare/aenderbare Optionen, Auswertung eigene/richtige Antwort, Quizfortschritt und Hostaktionen; Browsernachweis mehrerer Fragen. |
| P1 | FEAT-5 | server / CURRENT_STACK_ONLY | FEAT-3 | Metadatenkatalog ohne Loesungen, gespielte/verfuegbare Spiele, Punkte nur abgeschlossener Spiele, Gesamtpunkte und gemeinsamer Rang bei Gleichstand. |
| P1 | FEAT-14 | web / CURRENT_STACK_ONLY | TECH-2, FEAT-4, FEAT-5 | Zentrales Theme, immer eigener Name; Punkte/Platz nach erster Wertung; neutrale/richtige/falsche Markierung, Mobile First. |
| P1 | FEAT-6 | web / CURRENT_STACK_ONLY | FEAT-4, FEAT-5, FEAT-14 | Auswahl/Abwahl/Regeln/Starten; Projektor links/zentral/rechts; nur gespielte Spalten; vorheriges Ranking, Spiel einblenden, Hochzaehlen, Umsortieren. |
| P1 | FEAT-9 | server / CURRENT_STACK_ONLY | FEAT-3 | 60s, stabile zufaellige Anfangsreihenfolge je Spieler, genau alle Begriff-IDs, ein Punkt je Sollposition, Werte erst nach Aufloesung. |
| P1 | FEAT-10 | web / CURRENT_STACK_ONLY | FEAT-4, FEAT-9, FEAT-14 | Touch-/Drag-Sortierung, Draft, eigene Positionsmarkierung, Projektor-Sollfolge/Werte/Fehler, Host Beenden. |
| P1 | FEAT-11 | server / CURRENT_STACK_ONLY | FEAT-3 | 30s, endliche Zahlen, Abstand; Drittel ceil(N/3)/ceil(2N/3), Gleichstaende bessere Gruppe, alle Besten +2, fehlend 0, N=0, maximal 5. |
| P1 | FEAT-12 | web / CURRENT_STACK_ONLY | FEAT-4, FEAT-11, FEAT-14 | Zahleneingabe, eigene Eingabe/Abstand, Projektorranking, Host Weiter; keine Zielwertanzeige vor Aufloesung. |

TECH-4 darf bei fehlender DB-Freigabe blockieren, waehrend TECH-2 und Lobbyarbeit
weiterlaufen. `psql` wurde nicht im PATH gefunden. Der Orchestrator hat danach
mit `Get-Service -Name '*postgres*'` den Dienst `postgresql-x64-18` mit Status
`Running` nachgewiesen. DB-Login, Portzugriff und eine dedizierte Testdatenbank
sind damit noch nicht geprueft und werden vor TECH-4 lokal nachgewiesen.
Tests nutzen eine dedizierte lokale Testdatenbank,
keine produktiven Daten. Ein pg-Mock ersetzt den echten DB-Nachweis nicht.

Der Zusammenhang von FEAT-5 mit Wertungen wird durch FEAT-7/9/11 ueber die
gemeinsame Zustandsmaschine hergestellt. FEAT-5 braucht fuer seine eigene
isolierte Rankingabnahme keine fertige Implementierung aller Spielarten.

Test-/Lint- und Schreibscope fuer die vorhandenen Tasks:

| Tasks | Testbefehl | Lintbefehl | Code-Scope / Owner |
|---|---|---|---|
| TECH-1/4, FEAT-1/3/5/7/9/11/13 | `npm --prefix apps/server test` | `npm --prefix apps/server run lint` | `apps/server/`, server_developer; rote FEAT-Tests server_test_engineer |
| TECH-2, FEAT-2/4/6/8/10/12/14/15 | `npm --prefix apps/web test` | `npm --prefix apps/web run lint` | `apps/web/`, web_developer; rote FEAT-Tests web_test_engineer |
| TECH-3 | `npm --prefix contracts test` | kein verpflichtender ESLint-Befehl; `npm --prefix contracts run typecheck` als zusaetzliche Evidence | `contracts/`, integration_engineer |
| TECH-5 | `node scripts/check-state.mjs` | entfällt | fuenf `docs/feature-mvp-*.md` gemaess Task-Scope; Analyst, Validator, Architect, Planner |
| TECH-6 | `node --test test/task-metadata.test.mjs` | entfällt | `scripts/`, `test/`; gezielter Skript-Entwickler, unabhaengiger Reviewer |

TECH-1/2 brauchen zusaetzlich Build-/Startnachweise. TECH-4 fuehrt neben
isolierten Seedtests einen expliziten echten DB-Lauf aus, beispielsweise
`npm --prefix apps/server run test:db`; dieser Befehl wird im Scaffold/Harness
implementiert und als zusaetzliche Evidence erfasst. Fehlende DB-Zugangsdaten
oder ein nicht erreichbarer Dienst sind ein Umgebungsblocker; ein uebersprungener
DB-Test ist kein gruener DB-Nachweis. Die Farbrohwerte entstehen bereits in
TECH-2 ausschliesslich im Theme; FEAT-14 ergaenzt spaeter Statusleiste und
dynamische Farbmarkierungen, damit fruehe UI-Tasks keine Farbsystemduplikate bauen.

## Konkrete Installationsvorlage

Dies ist die direkte Paketliste zur Freigabe, kein bereits ausgefuehrter
Installationsbefehl. Versionspins werden nach freigegebenem Metadatenabruf auf
Node-24-Kompatibilitaet abgeglichen und in komponenteneigenen Lockfiles fixiert.
Transitive Abhaengigkeiten ergeben sich reproduzierbar aus diesen Lockfiles.

| Verzeichnis | Runtime-Pakete | Entwicklung/Test/Lint |
|---|---|---|
| `apps/server/` | `fastify`, `ws`, `pg` | `typescript`, `vitest`, `eslint`, `@eslint/js`, `typescript-eslint`, `@types/node`, `@types/ws`, `@types/pg` |
| `apps/web/` | `react`, `react-dom`, `react-router` | `vite`, `@vitejs/plugin-react`, `typescript`, `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/jest-dom`, `@types/react`, `@types/react-dom`, `@types/node`, `eslint`, `@eslint/js`, `typescript-eslint` |
| `contracts/` | `zod` | `typescript`, `@types/node`; Schema-Beispieltests mit Node-24-`node:test` |

Server und Web erhalten ausserdem eine lokale `file:../../contracts`-Referenz
auf den in TECH-3 definierten Paketnamen; das ist eine deklarierte Kopplung an
gemeinsame Artefakte. TECH-3 etabliert Exportpfade, Build und Typdeklarationen,
bevor Verbraucher diese Referenz nutzen. Native Node-24-TypeScript-Ausfuehrung
kann den lokalen Devstart abdecken; kein `tsx` ist vorausgesetzt.

Es werden keine CORS-, Drag-and-Drop-, State-Store-, ORM-, Socket.IO- oder
Browserautomationspakete vorausgesetzt. Lokale Browserpruefungen verwenden
vorhandene Browserwerkzeuge, automatisierte Server-E2E-Tests Vitest/ws und
Frontendtests RTL/jsdom. Ein fuer Touch nutzbarer Sortiergriff wird ohne
zusaetzliche Drag-Bibliothek implementiert und im echten Browser geprueft.
PostgreSQL bleibt der freigegebene Datenbankserver; seine Installation oder
die Anlage lokaler Datenbanken wird erst nach konkreter Umgebungspruefung
und der dafuer erforderlichen Freigabe vorgenommen. Keine Stackabweichung.

## Metadatenworkflow: TECH-6

Scope: `scripts/` und `test/`, insbesondere add-task.mjs, update-task.mjs und gemeinsam
genutzte Validierung; Tests `test/task-metadata.test.mjs` und bestehender
Selftest. Keine manuelle state.json-Aenderung, keine Absenkung eines DONE-Gates.

- add-task und update-task unterstuetzen `--classification` und `--priority`;
  update-task zusaetzlich `--component`, `--deps`, `--ak` und soweit fuer
  die vorhandenen TODOs erforderlich `--title`, `--test`, `--lint`.
  Beide akzeptieren contracts als virtuelle Artefakt-Komponente; check-state
  prueft sie ohne neue App-Komponente.
- Klassen nur CURRENT_STACK_ONLY/TARGET_ALIGNED/REQUIRES_MIGRATION; Prioritaet
  P0/P1/P2; CONTRACT_CHANGE wird im TECH-Titel und Plan benannt. Bestehende optionale
  Metadaten duerfen historische Tasks nicht ungueltig machen.
- Unbekannte IDs, Selbstabhaengigkeiten und Zyklen werden vor jedem Schreiben
  abgewiesen. Fehlgeschlagene Aenderungen lassen State und generierte Dateien
  unveraendert. `--deps` ist von vorhandenem `--deps-change` zu unterscheiden.
- Zentrale AK/Dependencies laufender oder abgeschlossener Tasks bleiben
  unveraenderlich; Nachschaerfung nur bei TODO. Reviewer-, Evidence-, Scope-,
  Inventar- und Transitionregeln bleiben erhalten.
- node:test verwendet isolierte Temp-Repos mit minimalen Fixtures. Der
  bestehende Selftest kopiert aktuell den Projektstate und kollidiert mit
  bereits vorhandenem FEAT-1; seine Temp-Fixture auf einen leeren Taskstand
  normalisieren, niemals den echten Arbeitsstand.
- TDD: neue Metadatenflags und negative Schreibversuche zuerst rot erfassen;
  danach Implementierung und gruene Tests, unabhaengiges Branch-Diff-Review.

## Neue Tasks: nur diese IDs zusaetzlich anlegen

TECH-5 fuer Planungsartefakte und TECH-6 fuer Governance sind bereits angelegt;
sie werden nicht dupliziert. Die folgenden Befehle sind Vorschlaege zur
Ausfuehrung auf main; sie wurden von diesem Planungsauftrag nicht ausgefuehrt.

Die folgenden Befehle verwenden die in TECH-6 bereitzustellenden Flags.

```powershell
node scripts/add-task.mjs FEAT-15 --component web --title "F8 Client-Sessionablage und Reconnect" --ak "Refresh/Link stellt vorhandene Rolle, Spieler-ID, Draft, Finalsperre und Deadline wieder her; kein Doppelbeitritt; klare Meldung nach Serverneustart" --test "npm --prefix apps/web test" --lint "npm --prefix apps/web run lint" --deps "FEAT-2,FEAT-13" --classification CURRENT_STACK_ONLY --priority P0
node scripts/add-task.mjs TECH-7 --component server --title "Lobby- und Reconnect-Integration mit Inventaraudit" --ak "Host und Projektor plus zwei Spieler real ueber REST/WS; unbefugte Moderation abgewiesen; Refresh ohne Duplikat; spaeter Spieler wartet; Scope-Audit und Browserbelege fuer diese Faehigkeiten" --test "npm --prefix apps/server test -- test/e2e/lobby.test.ts" --lint "npm --prefix apps/server run lint" --deps "FEAT-1,FEAT-2,FEAT-3,FEAT-13,FEAT-15" --scope apps/server/ --scope docs/validation/lobby.md --classification CURRENT_STACK_ONLY --priority P0 --no-tdd
node scripts/add-task.mjs TECH-8 --component server --title "Quiz-Integration mit Inventaraudit" --ak "Mehrere Quizfragen mit Einzelauswertung, frueher Abschluss, Timeout samt Nachfrist, Rollenfilter und Quizabschluss genau einmal; Browserbelege und Audit zu Quiz/Timer" --test "npm --prefix apps/server test -- test/e2e/quiz.test.ts" --lint "npm --prefix apps/server run lint" --deps "FEAT-7,FEAT-8" --scope apps/server/ --scope docs/validation/quiz.md --classification CURRENT_STACK_ONLY --priority P0 --no-tdd
node scripts/add-task.mjs TECH-9 --component server --title "Sortier-Integration mit Inventaraudit" --ak "Touch-/Drag-Browserablauf und reale WS-Wertung; stabile Reihenfolge nach Refresh; Timeout, Wertefilter und Positionspunkte; Inventaraudit zu Sortieren" --test "npm --prefix apps/server test -- test/e2e/sort.test.ts" --lint "npm --prefix apps/server run lint" --deps "FEAT-9,FEAT-10" --scope apps/server/ --scope docs/validation/sort.md --classification CURRENT_STACK_ONLY --priority P1 --no-tdd
node scripts/add-task.mjs TECH-10 --component server --title "Schaetz-Integration mit Inventaraudit" --ak "Reale WS- und Browserablaeufe; Drittel fuer 2/4/5 gueltige Eingaben, Gleichstaende, alle besten, fehlend und N=0; Zielwertschutz; Inventaraudit zu Schaetzen" --test "npm --prefix apps/server test -- test/e2e/estimate.test.ts" --lint "npm --prefix apps/server run lint" --deps "FEAT-11,FEAT-12" --scope apps/server/ --scope docs/validation/estimate.md --classification CURRENT_STACK_ONLY --priority P1 --no-tdd
node scripts/add-task.mjs TECH-11 --component web --title "Ranking- und Darstellungsabnahme mit Inventaraudit" --ak "Projektorlayout, abgeschlossene Spielspalten und vier Animationsschritte; Hostauswahl; mobile Statusleiste und Theme; Browserbelege und Audit fuer Ranking/Design" --test "npm --prefix apps/web test -- test/e2e/ranking.test.tsx" --lint "npm --prefix apps/web run lint" --deps "FEAT-5,FEAT-6,FEAT-14" --scope apps/web/ --scope docs/validation/ranking.md --classification CURRENT_STACK_ONLY --priority P1 --no-tdd
node scripts/add-task.mjs TECH-12 --component server --title "Lokale Systemdokumentation und MVP-Abschlussbericht" --ak "Build/Start/Shutdown beider Apps und PostgreSQL-Anbindung real nachgewiesen; README und final-report mit echten Evidencepfaden und bekannten Problemen; Scope-Audit vor Bericht; erledigte Tasks archiviert" --test "node scripts/check-state.mjs" --deps "TECH-7,TECH-8,TECH-9,TECH-10,TECH-11" --scope README.md --scope docs/ --classification CURRENT_STACK_ONLY --priority P2 --no-tdd
```

TECH-7–11 sind unabhaengige Integrations-/Auditpakete. Ein Sortierfinding
blockiert beispielsweise weder Lobby- noch Quizabnahme. Sie verhindern nicht
das DONE bereits separat gepruefter Features. TECH-12 ist ausschliesslich der
abschliessende Bericht zum gesamten MVP; es ersetzt kein Einzelreview.
Erzeugt ein TECH-Task selbst eine nutzerpruefbare Faehigkeit, braucht auch er
einen Inventareintrag; reine Tests/Auditberichte brauchen keinen neuen Eintrag.

## Nachpflege der bestehenden TODOs

Nach TECH-6 werden Prioritaet, Klasse, Abhaengigkeiten und nachgeschaerfte AK
aus der Tabelle fuer jeden bestehenden Task gesetzt. Beispiel:

```powershell
node scripts/update-task.mjs TECH-1 --classification TARGET_ALIGNED --priority P0 --deps "TECH-5,TECH-3"
node scripts/update-task.mjs TECH-3 --component contracts --classification TARGET_ALIGNED --priority P0 --title "CONTRACT_CHANGE: versionierte REST- und WS-Schemas" --deps "TECH-5,TECH-6" --deps-change
node scripts/update-task.mjs FEAT-3 --classification CURRENT_STACK_ONLY --priority P0 --deps "FEAT-1,FEAT-13,TECH-4" --ak "Hostphasen mit eingefrorenen Teilnehmern; neue spaete Spieler warten bis naechste Spielauswahl; deadline+2000ms inklusiv; atomare Finalabgabe, Finalsperre und frueher Abschluss; Aufloesen nur nach CLOSED; rollengefilterte Snapshots ohne Loesungen vor Auswertung"
node scripts/update-task.mjs FEAT-11 --classification CURRENT_STACK_ONLY --priority P1 --deps FEAT-3 --ak "30s; gueltige letzte endliche Zahl; N nur gueltige Eingaben; Grenzraenge ceil(N/3) und ceil(2N/3); Gleichstaende bessere Stufe, alle Besten +2, maximal5; fehlend0 ausserhalb Rang und N=0 ohne Bonus"
```

Die sonstigen Zeilen werden analog gepflegt; bereits bestehende Tasks werden
nicht erneut mit add-task angelegt. TECH-3 benoetigt eine eigene reproduzierbare
Typecheck-/Schema-Testumgebung in contracts, ohne fremde Komponentenmanifeste
auf seinem Branch anzupassen. Sein derzeitiges npx-Typecheck-Kommando darf erst
nach der Installation lokal aufloesbarer freigegebener Dependencies verwendet
werden; kein ungeprueftes Nachladen durch npx. Ein passender Testbefehl wird bei
der Metadatenpflege vor Taskstart festgelegt.

## Delegation, Tests, Reviews und Inventar

Pro Task: main synchronisieren, Metadaten/Status auf main pflegen und committen,
Task-Branch via branch-task.mjs. Maximal drei parallele Subagents; Schreibarbeit
bei gemeinsamem Checkout nur an getrennten Dateien, Branchwechsel zentral durch
den Orchestrator. Komponenten-Developer aendern ausschliesslich ihre Komponente;
contracts nur integration_engineer. Reviewer haben den Code nicht geschrieben.

FEAT-Tasks: komponentenspezifischer Test Engineer erstellt zuerst einen wirklich
fehlgeschlagenen AK-Test via record-check.mjs. Developer implementiert danach.
Gruener Test und ESLint/tsc-Lint laufen ebenfalls via record-check. TECH-6 ist
ebenfalls TDD; TECH-4 sollte wegen testbarer Migration/Seedlogik vor Umsetzung
auf TDD gesetzt werden. Ein fehlendes npm-Paket gilt als Umgebungsfehler und
ersetzt keinen roten fachlichen Test.

Code Review auf main...TASK ist fuer jeden Task erforderlich und umfasst
Stackkonformitaet, Lint, Dependencies, Scope, Inventardopplungen und
Fehlerbehandlung. Security Review zusaetzlich fuer TECH-3/4, FEAT-1/3/7/9/11/13/15
und eingabeverarbeitende Webarbeit; Rollen, Eingabeschemas, Parameterbindung,
Tokenlecks und Loesungsfilter tatsaechlich pruefen. Findings/Reviewer in
tasks/reviews/ID.md. Hoestens drei gezielte Fixversuche pro Finding erfassen.

Jede nutzerpruefbare Capability erhaelt auf main ihren INV-Eintrag mit konkreten
test-/route-/file-Ankern; jede UI-Aenderung zusaetzlich einen wirklich
nachgespielten ui_step. Der Scope Auditor fuehrt Anker aus und meldet pro
Eintrag vorhanden/verloren/nicht pruefbar. Keine pauschale Gruenmeldung.

Nach unabhaengigem Review: nur bei Remote Task-Branch pushen, merge-task.mjs,
Inventar/Taskverknuepfung und finale Evidence auf main, erst dann DONE.
check-state.mjs, check-inventory.mjs und verify.mjs muessen gruen bleiben.
Lokale Builds/Browserablaeufe und Datenbanktests werden im jeweiligen Bericht
mit Befehlen, Exitcodes, Evidencepfaden und Einschraenkungen dokumentiert.
Keine Deployments, kein Push von main, keine Secrets ausgeben oder speichern.

## Ausgefuehrte Pruefungen dieses Planungsauftrags

Dateilekture von agent-context, tech-stack, Requirements, Architektur,
Validierung, state.json, add-task/update-task, verify, scope und add-component.
Keine Code-, Browser-, Datenbank- oder Workflowtests ausgefuehrt.
Geaendert wurde ausschliesslich dieses Planungsdokument.
