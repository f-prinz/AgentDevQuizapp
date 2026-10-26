# Code Review FEAT-13

Reviewer: `code_reviewer`, unabhaengig von `server_developer`.
Gepruefter Commit: `7b574ba219b0929ecfd0bc229cda0c9616280d77`.
Der vollstaendige Diff `main...FEAT-13` wurde gelesen: `app.ts`, Server-README,
`reconnect.test.ts` und alle vier Evidence-Dateien. Grundlage sind die
aktualisierten FEAT-13-Akzeptanzkriterien aus `tasks/state.json`,
`AGENTS.md`, `docs/agent-context.md`, `docs/tech-stack.md`, die vorhandenen
Vertraege und der bestehende Lobbycode. Keine Autorenrationale als Evidenz.

Ergebnis: **freigegeben; keine offenen Findings oder Blocker**.

## Konkreter Kriterienabgleich

| Aktuelles FEAT-13-Kriterium | Gelesener Nachweis |
| --- | --- |
| Reauth erhaelt Rolle, Spieleridentitaet, Namen und aktuelle Lobbyphase ohne Doppelbeitritt | `app.ts:191` verwendet die bestehende `LobbyRegistry.authenticate` und sendet einen aktuellen Snapshot. `lobby.ts:137` liest die gespeicherte Sitzung; nur `joinPlayer` erzeugt einen Teilnehmer. Der neue Test schliesst Host-, Projektor- und Spielerverbindung nach dem Start und authentifiziert alle erneut: gleiche Rollen, Spieler-ID, Name, `overview` und weiterhin genau zwei Teilnehmer. |
| Mehrere Verbindungen halten connected, solange mindestens eine lebt | Der vorhandene Zaehler wird bei Auth erhoeht (`app.ts:201`). Der gemeinsame Close-Handler vermindert ihn und setzt erst beim letzten Socket `connected=false` (`app.ts:325`). Der neue Test prueft beide Schliessschritte derselben Spielersitzung. |
| Alte Sitzung nach Serverneustart abweisen | Jede Serverinstanz besitzt weiterhin eine eigene Registry (`app.ts:109`). Der Test schliesst die erste Instanz, startet eine neue und erwartet fuer deren alte Sitzung `LOBBY_NOT_FOUND`. Dies ist ein Instanzneustart im Testprozess; kein eigener Betriebssystem-Prozessneustart wurde vom Reviewer ausgefuehrt. |
| Ping/Pong alle 30 Sekunden; stille Verbindung im Folgezyklus beenden, Sitzung und Teilnehmer behalten | Default `30_000` ms (`app.ts:55`). Der Intervallhandler markiert offene Verbindungen als ausstehend, sendet Ping und terminiert sie beim folgenden Durchlauf ohne Pong (`app.ts:116`). Pong setzt nur diesen Verbindungsstatus zurueck (`app.ts:303`). Termination nutzt denselben Close-Handler; dieser entfernt weder Sitzung noch Teilnehmer. |
| Kurzer intern injizierter Testtakt und Timer-Cleanup | `BuildServerOptions.heartbeatIntervalMs` ist eine interne Factory-Option mit positiver Ganzzahlpruefung. Der Test nutzt 50 ms, wartet auf zwei Pings eines Auto-Pong-Clients und auf das Schliessen eines stillen Clients. `unref` (`app.ts:128`) und `clearInterval` im Shutdown (`app.ts:344`) sind vorhanden. |

Aktive Rundendaten/Draft/Finalstatus sind laut aktualisiertem Task-Kriterium
in FEAT-3 zu integrieren. Sie werden mit diesem Review nicht als implementiert
oder getestet bestaetigt. README beschreibt den tatsaechlichen Reauth- und
Heartbeat-Ablauf.

## Stack, Invarianten, Scope und Duplikation

Node/TypeScript/ESM, Fastify, `ws`, Vitest und ESLint/tsc bleiben unveraendert.
Keine Dependencies, Manifest-/Lockfile-Aenderungen, Vertragsaenderungen oder
fremden Komponenten im Diff. Lobbys und Sitzungen bleiben ausschliesslich
in-memory; kein zusaetzlicher Speicherweg. Tokenpruefung, Rollenbindung,
Snapshotfilter und Timer-/Antwortannahmeregeln werden nicht veraendert.
Heartbeat ist WS-Transportlogik und veraendert keine Spieldeadline.

`docs/feature-inventory.md` referenziert: INV-3/4 enthalten bereits
Lobby-/Sitzungserstellung und Teilnehmerverwaltung; diese werden fuer Reauth
und Verbindungsstatus wiederverwendet. Es entsteht keine zweite Join- oder
Sitzungsimplementierung. INV-1/2/5 bleiben unberuehrt. Kein UI-/Browser-Review
oder vollstaendiger MVP-Abschluss wird behauptet.

## Ausgefuehrte Befehle und Evidence

| Vom Reviewer ausgefuehrt | Ergebnis |
| --- | --- |
| `Get-Content` / `rg` fuer aktuelle Regeln, Task-Kriterien, Inventar und betroffene Codepfade | Kriterien und Invarianten konkret abgeglichen. |
| `git status --short --branch`, `git diff --stat main...FEAT-13`, `git diff --numstat main...FEAT-13`, `git rev-parse FEAT-13` | Stand 7b574ba; vor Review-Artefakten sauber auf FEAT-13, sieben Dateien im Implementierungsdiff. |
| Dateigruppenweise `git diff main...FEAT-13 -- ...` | Gesamten Diff und alle vier Evidence-Dateien gelesen. |
| `npm --prefix apps/server run lint` | Eigener Reviewer-Lauf, Exit 0; ESLint und `tsc --noEmit` ohne Findings. |
| `git diff --check main...FEAT-13` | Keine Whitespacefehler. |

Gelesene, nicht vom Reviewer erneut ausgefuehrte Evidence:

- `FEAT-13-2026-10-26T15-27-16-383Z.json`: Exit 1; drei bestehende
  Reauth-/Verbindungstests gruen, neuer Heartbeattest rot wegen fehlendem Ping.
- `FEAT-13-2026-10-26T15-29-44-607Z.json`: Exit 0; **38/38 Tests** in
  sieben Dateien einschliesslich Reconnect/Heartbeat und PostgreSQL-Suiten.
- `FEAT-13-2026-10-26T15-29-52-535Z.json`: Lint, Exit 0.
- `FEAT-13-2026-10-26T15-29-57-604Z.json`: Build, Exit 0.

Geaenderte Datei durch den Reviewer: ausschliesslich `tasks/reviews/FEAT-13.md`.
Offene Blocker nach Fehlerklasse (`code|werkzeug|umgebung|entscheidung`): keine.
