# Raccoons Quizgame

Lokale Quiz-Party-App: Host steuert Lobby und Spiele (Quiz/Sortieren/Schätzen), Spieler antworten auf dem eigenen Gerät, der Projektor zeigt Auftrag, Auswertung und animierte Rangliste. Komponenten: Fastify-WebSocket-Server (`apps/server/`), React-Vite-Client (`apps/web/`), geteilte zod-Verträge (`contracts/`).

**Vollstaendige Anleitung von Einrichtung bis Meilenstein: [`docs/usage.md`](docs/usage.md).**

## Neues Projekt aufsetzen

Pflichtangaben, ohne die der Prozess nicht startet:

- [ ] `git init -b main` + erster Commit, danach `node scripts/install-hooks.mjs` — der gesamte Branch-/Scope-/Tripwire-Workflow setzt ein git-Repository mit installiertem Hook voraus; ohne git laufen die Pruefungen nur noch als Warnungen.

- [ ] `docs/project-idea.md` mit der Projektbeschreibung füllen (Rollen, Abläufe, Datenstrukturen – je konkreter, desto weniger Rückfragen). Solange die Datei leer ist, fragt der Orchestrator gemäß `AGENTS.md` nach.
- [ ] `docs/tech-stack.md`: Komponenten-Matrix füllen (Komponente, `apps/<name>/`, Zweck) und je Komponente den Stack freigeben (Sprache, Framework, Kommunikation, Persistenz, Testframework). Ohne Freigabe bleibt die Planung bewusst blockiert.
- [ ] **Pro Komponente** `node scripts/add-component.mjs <name> --purpose "<zweck>"` ausführen (legt Agenten-Paar aus `docs/templates/` an, registriert sie in `.codex/config.toml`, ergänzt `tasks/state.json`, Matrix in `docs/tech-stack.md`, Tabelle in `docs/agent-context.md` und `apps/<name>/`). Danach `node scripts/verify.mjs` muss grün sein.
- [ ] Projektname in `package.json` anpassen, ggf. Verzeichnis umbenennen.

Erst nach Stack-Entscheidung sinnvoll (teilweise vom Prozess gesetzt):

- [ ] Komponenten-Manifeste in `apps/<name>/` (package.json, pom.xml, pubspec.yaml o. ä.) inkl. Build-/Test-/Startbefehlen; `docs/agent-context.md`-Komponententabelle damit füllen.
- [ ] `.env.example`: benötigte Umgebungsvariablen dokumentieren (ggf. je Komponente).
- [ ] `docs/agent-context.md`: domänenspezifische Sicherheits-/Vertragsinvarianten ergänzen (global und pro Komponente).
- [ ] Playbooks in `docs/playbooks/`: Prüfbefehle wieder konkretisieren.

Optional:

- [ ] `npm test` (`scripts/selftest.mjs`): End-to-End-Test aller Gates in einem Temp-Repo — empfohlen nach dem Einrichten und nach jeder Template-Aenderung.
- [ ] Agent-Roster in `.codex/` prüfen (14 Basis-Agents + je 2 pro Komponente; `node scripts/verify.mjs` prüft Registrierung in beide Richtungen).
- [ ] Task-ID-Präfix: `scripts/check-state.mjs`/`update-task.mjs`/`record-check.mjs` akzeptieren `TECH`, `BUG`, `CHG`, `FEAT` – bei anderem Präfix dort anpassen.
- [ ] `docs/changes.md`: Eingangskorb für aufgeschobene Änderungswünsche (Tags `[CHG]`/`[FEAT]`/`[BUG]`); Archivierung nach `docs/changes-archive.md`.

Requirements, Architektur, Datenmodell, Backlog (`tasks/`) und Berichte (`docs/`) erzeugt der Agent-Prozess aus der Projektidee heraus selbst.

## Framework starten

Voraussetzung: Die Pflichtangaben oben sind erledigt – insbesondere ist `docs/project-idea.md` gefüllt. Das Framework wird nicht per Befehl, sondern per Prompt an den Orchestrator angestoßen: Codex-Sitzung im Projektordner starten und den Inhalt der passenden Prompt-Datei als ersten Auftrag einreichen. `AGENTS.md` und die `.codex/`-Agenten werden automatisch geladen.

| Situation | Prompt |
|---|---|
| Erststart: Idee → Requirements → Architektur → Backlog → MVP | Inhalt von `docs/start-prompt.md` einreichen |
| Iterative Weiterentwicklung im laufenden Taskbetrieb | Inhalt von `docs/automation-prompt.md` einreichen |
| Unterbrochene Sitzung fortsetzen | Inhalt von `docs/resume-prompt.md` einreichen – liest `tasks/state.json`, `tasks/backlog.md` und `docs/progress.md` und setzt am letzten geprüften Zustand fort |

Danach reicht für eingehende Anfragen die normale Formulierung des Anliegens: Der Orchestrator klassifiziert jede Anfrage automatisch als BUG, CHANGE, FEATURE (User Story) oder QUESTION und wendet das passende Playbook aus `docs/playbooks/` an; interne technische Tasks laufen als TECH. Einträge in `docs/changes.md` werden über das zugehörige Playbook abgearbeitet – einfach auf die Datei verweisen. Vorlagen für vollständige Anfragen (weniger Rückfragen): `docs/templates/request-*.md`.

Hinweise:

- Empfohlenes Orchestrator-Modell laut `.codex/config.toml`: `gpt-6.1-sol` mit hohem Reasoning-Effort (via `--model` beim Sitzungsstart); Subagent-Modelle sind dort bereits zugewiesen.
- Maximal 3 parallele Subagents (`max_threads` in `config.toml`).
- Fortschritt und Nachweise laufend in `tasks/state.json`, `tasks/backlog.md` (generiert, nicht editieren) und `docs/progress.md` prüfbar.
- Statuswechsel nur via `node scripts/update-task.mjs` (Transitionen werden erzwungen); Tests als Evidence via `node scripts/record-check.mjs <TASK-ID> -- <befehl>`; DONE ist ohne Evidence mit Exit-Code 0 und Reviewer != Implementer nicht möglich.
- Jeder Task läuft auf einem eigenen Branch (Name = Task-ID): `branch-task` → Arbeit → `push-task` (nur bei Remote) → `merge-task` → DONE auf main. Buchhaltungsdateien werden nur auf main committed. TDD ist Standard bei FEAT/BUG (roter Test zuerst). Wie Tasks aussehen und was sie brauchen: `docs/task-templates.md`.
- Der umgesetzte Funktionsumfang steht in `tasks/inventory.json` (Pflicht vor DONE; `node scripts/render-inventory.mjs` rendert `docs/feature-inventory.md`). Vor Meilensteinen prüft der `scope_auditor` das Inventar gegen den Ist-Zustand (`docs/playbooks/audit.md`).

## Lokal starten

Voraussetzung: Node.js ≥ 20 und PostgreSQL (Katalog-/Spieldaten, siehe `apps/server/README.md`).

```powershell
npm install                                # Root + Workspaces (server, web, contracts)
Copy-Item .env.example .env                # Variablen anpassen (DATABASE_URL, Ports)
npm --prefix apps/server run dev           # Server auf http://127.0.0.1:3000 (Fastify + WS)
npm --prefix apps/web run dev              # Web auf http://127.0.0.1:5173 (Proxy /api,/ws -> :3000)
```

Ablauf im Browser: Host legt unter `/` eine Lobby an, teilt Host-/Projektor-/Spieler-Links, startet die Lobby ab zwei Spielern, wählt in der Übersicht Spiele aus und steuert die Runden (Start → Auflösen → nächste Frage/beenden). Der Projektor zeigt Aufgabe, Timer, Auswertung und Rangliste; Spieler antworten auf dem eigenen Gerät.

## Spiele zum Katalog hinzufügen

Statisch: JSON-Dateien unter `apps/server/seeds/` (werden beim Start validiert und in den Katalog synchronisiert). Zur Laufzeit: die Admin-Seite unter `/admin` oder direkt die Endpunkte — `GET /games` (Katalog), `POST /games` (Upload), `DELETE /games/:id` (Löschen). Schreibende Endpunkte verlangen `Authorization: Bearer <ADMIN_TOKEN>` (siehe `apps/server/.env.example`; ohne gesetztes Token sind sie deaktiviert).

Das Upload-JSON entspricht einer Seed-Datei, aber **ohne `id`-Felder** — Spiel-, Fragen-, Options- und Term-IDs erzeugt der Server als UUIDs. Bei Quizfragen wird die richtige Option per `correctOptionIndex` (0-basiert) benannt; alternativ darf `correctOptionId` auf eine mitgelieferte Options-`id` verweisen.

## Hosting (Docker/Railway)

Das Root-`Dockerfile` baut ein All-in-One-Image: der Fastify-Server liefert das Web-Build aus `apps/web/dist` statisch aus (SPA-Fallback auf `index.html`) und bedient API + WebSocket auf einem Port. Zusätzlich wird ein Postgres-Service benötigt.

Pflicht-Variablen auf der Plattform: `DATABASE_URL` (Remote-DB, z. B. `postgresql://…@postgres.railway.internal:5432/…`), `DATABASE_ALLOW_REMOTE=true` (ohne Flag lehnt der Server nicht-lokale Hosts ab), `HOST=0.0.0.0`, `PORT` (Plattform-injiziert), `STATIC_DIR` (im Image bereits auf `/app/apps/web/dist` gesetzt), `ALLOWED_ORIGINS` (öffentliche Domain für den WS-Origin-Check), optional `ADMIN_TOKEN` für die Admin-Endpunkte.

## Prüfungen

```powershell
node scripts/check-state.mjs
node scripts/check-inventory.mjs
node scripts/verify.mjs
npm test                             # scripts/selftest.mjs: End-to-End-Test aller Gates in einem Temp-Repo

npm --prefix apps/server test        # Server-Unit- + e2e-Tests (Vitest, ws)
npm --prefix apps/web test           # Web-Tests (Vitest + Testing Library)
npm --prefix apps/server run lint    # eslint + tsc
npm --prefix apps/web run lint       # eslint + tsc
```

Betrieb: `docs/orchestrator-checklist.md` (Kurzfassung aller Gates + Befehlssequenz).

Entwicklung und Betrieb erfolgen lokal. Kein Deployment; Push nur Task-Branches bei konfiguriertem Remote (`push-task.mjs`), main nie.
