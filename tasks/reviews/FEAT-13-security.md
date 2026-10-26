# Security Review FEAT-13

Reviewer: `security_reviewer`, unabhaengig von `server_developer`.
Stand: `7b574ba219b0929ecfd0bc229cda0c9616280d77`, Diff `main...FEAT-13`
(sieben Dateien). **Freigegeben; keine offenen Sicherheitsfindings.**

Geprueft wurden Agent-Kontext/Stack, aktualisierte FEAT-13-Akzeptanzkriterien,
Inventar, vollstaendiger Diff, bestehender Auth-/Sitzungscode und die vier neuen
Reconnecttests. Scope ist Transport-/Sitzungswiederherstellung; aktive
Rundendaten werden gemaess Task erst in FEAT-3 integriert.

## Pruefergebnis

- `apps/server/src/app.ts:116`: Heartbeat fuehrt ausschliesslich die eigenen
  WS-Clients und deren Verbindungszustand. Nur OPEN-Sockets werden gepingt;
  ein ausbleibender Pong beendet beim Folgetakt genau diesen Socket.
  `pong` setzt ausschliesslich dessen `isAlive` zurueck (`:303`), ohne
  Authentifizierung, Rollen oder Sitzungen zu veraendern. Zwischen
  Statuspruefung und `ping` liegt kein asynchroner Zustandswechsel.
- Der vorhandene WS-Error-Handler bleibt registriert. Close-Cleanup entfernt
  die Verbindung und ihren Auth-Timer; erst der letzte Socket derselben
  authentifizierten Spielersitzung setzt `connected=false` (`:325`). Der
  Disconnect entfernt weder Registry-Sitzung noch Teilnehmer. Reauth nutzt
  denselben bestehenden Hashvergleich und die serverseitig gespeicherte Rolle;
  es entsteht kein zweiter Auth- oder Beitrittspfad.
- Ein Intervall pro Serverinstanz, standardmaessig 30 s; `unref()` verhindert
  ein allein durch den Timer offen gehaltenes Programm. `preClose` loescht
  das Intervall vor Socket-Termination (`:344`). Der interne Testparameter
  wird vor Ressourcenanlage als positive sichere Ganzzahl validiert; er
  ist weder REST-/WS-Eingabe noch neue Betriebskonfiguration.
- Keine neuen Secrets, Tokenausgaben, URLs mit Zugangsdaten oder Logs.
  Heartbeat uebertraegt leere Kontrollframes. Bestehende strikte
  Eingabevalidierung, Originpruefung, Rollenprojektion und Token-Hashhaltung
  bleiben erhalten. Keine Nutzerdaten als HTML, keine neue Persistenz.
- Node/TypeScript/Fastify/ws bleiben stackkonform; keine Dependency-,
  Manifest-, Lockfile-, Vertrags- oder fremde Komponentenaenderung. Bestehende
  Session- und Verbindungszaehlung wird wiederverwendet; Inventar INV-3/4/5
  wurde abgeglichen, kein paralleler Sitzungsmechanismus eingefuehrt.

## Gelesene Root-Evidence

Alle Dateien liegen unter `tasks/evidence/`:

| Datei | Aufgezeichnetes Ergebnis |
| --- | --- |
| `FEAT-13-2026-10-26T15-27-16-383Z.json` | `npm --prefix apps/server test -- test/reconnect.test.ts`, Exit 1: 3 bestanden, 1 fachlich rot wegen fehlendem Server-Ping. |
| `FEAT-13-2026-10-26T15-29-44-607Z.json` | `npm --prefix apps/server test`, Exit 0: 38/38 Tests, sieben Dateien. Neue Tests: Rollen-/Spieleridentitaet und Phase ohne Doppelbeitritt, Mehrfachverbindungen, alte Sitzung nach neuer Serverinstanz abgewiesen, Ping/Pong mit gesundem und stillem Peer. |
| `FEAT-13-2026-10-26T15-29-52-535Z.json` | `npm --prefix apps/server run lint`, Exit 0: ESLint und tsc. |
| `FEAT-13-2026-10-26T15-29-57-604Z.json` | `npm --prefix apps/server run build`, Exit 0. |

Diese Laeufe hat der Orchestrator ausgefuehrt; der Security Reviewer hat Code
und Evidence gelesen und die Laeufe nicht wiederholt. Der Test mit zwei
Serverinstanzen belegt neue Registry-Zustaende, keinen eigenen OS-Prozessneustart.
Shutdown mit offenem gesundem WS wird im Heartbeattest ausgefuehrt;
Timerbereinigung und Lebenszyklus wurden zusaetzlich statisch geprueft.
Keine externen Scans, Dienstzugriffe oder Browserpruefungen durch den Reviewer.

## Ausgefuehrte Befehle | Ergebnis

| Befehl | Ergebnis |
| --- | --- |
| `Get-Content`, `rg --files`, `rg -n`, `Select-String` | Vorgaben, Source, Task/Inventar, Tests und vier Evidence-Dateien gelesen. Ein exakt zitierter rg-Suchausdruck fand nichts (Exit 1); Task wurde anschliessend mit Select-String gelesen. |
| `git status --short --branch`, `git rev-parse HEAD` | Vor Review-Artefakt sauberer FEAT-13-Stand 7b574ba. |
| `git diff --stat main...FEAT-13`, `git diff --name-status main...FEAT-13`, `git diff main...FEAT-13 -- apps/server/src/app.ts apps/server/README.md` | Diff und Scope geprueft; neue Tests und Evidence vollstaendig separat gelesen. |
| `git diff --check main...FEAT-13` | Exit 0. |

Geaenderte Datei: nur `tasks/reviews/FEAT-13-security.md`.
Blocker (`code|werkzeug|umgebung|entscheidung`): keine.
