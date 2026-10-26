# Security Review FEAT-1

Reviewer: `security_reviewer`, unabhaengig von `server_developer`.
Gepruefter Commit: `bb8b68375abecb60c46ca2d94458f56f5ac5ecbd`;
Branch-Diff `main...FEAT-1`, zehn Dateien einschliesslich vier Evidence-Dateien.
Ergebnis: **freigegeben; keine offenen Sicherheitsfindings oder Blocker**.

## Pruefumfang und Befunde

AGENTS, Agent-Kontext, freigegebener Stack, Projektidee, MVP-Anforderungen,
Architektur/Plan, Vertragsmodelle/README und vorhandenes Inventar wurden gelesen.
Geprueft sind Lobby-Erstellung/-Beitritt und rollenbezogenes REST/WS-Verhalten;
spaetere Spielphasen und Webdarstellung sind nicht Gegenstand dieses Reviews.

| Vertrauensgrenze | Ergebnis der statischen Pruefung |
| --- | --- |
| Sitzungsgeheimnisse | `lobby.ts:52` erzeugt je Sitzung 32 kryptographisch zufaellige Bytes; im Registry-Zustand steht ausschliesslich SHA-256, Vergleich mit `timingSafeEqual` (`:145`). Rollen/Spieler-ID stammen aus der gespeicherten Sitzung. Host/Projektor erhalten getrennte Sitzungen; der Spielerlink enthaelt keine fremden Zugangsdaten. |
| Socket-Identitaet und Rechte | `app.ts:161` verlangt Auth als erste Nachricht; `:173` bindet den Socket an das authentifizierte Serverobjekt. Erneute Auth wird abgewiesen. `lobby.ts:165` erlaubt Start nur dem Host und ab zwei Spielern; `:177` erlaubt nur die eigene Spielernamensaenderung. Clientbefehle koennen keine Rolle oder fremde Spieler-ID einschleusen. |
| Eingaben und Transport | REST und WS verwenden die bestehenden strikten zod-Schemas; Namen werden getrimmt und auf 20 Zeichen begrenzt. JSON-Parsing und Binaernachrichten werden abgefangen. `app.ts:99` setzt 16 KiB maxPayload, `:272` 10 s Auth-Frist, `:284` 60 Nachrichten je 10 s und Socket. Transportfehler haben einen Error-Handler. Diese Grenzen erzeugen kein fachliches Spielerlimit. |
| Origin und URLs | `app.ts:261` weist fremde Browser-Origins vor Upgrade/Auth ab. Defaults erlauben nur lokale Vite-Origins; explizite LAN-Origins werden in `config.ts:16` normalisiert und ohne Pfad, Credentials, Query oder Fragment eingelesen. `/ws` akzeptiert keine Query. Host-/Projektortokens stehen nur im Fragment der erzeugten Links. ALLOWED_ORIGINS ist in Beispielkonfiguration und README dokumentiert. |
| Ausgaben und Privatsphaere | `lobby.ts:74` projiziert ausschliesslich ID, Art, Titel, Regeln und played. Rollen-Snapshots (`:191`) enthalten weder Sitzungstokens/-hashes noch rohe Seeds, Fragenloesungen oder fremde private Eingaben. Nutzernamen bleiben JSON-Text; keine HTML-Erzeugung im Serverdiff. Fehler sind feste bereinigte Texte; Auth-/Transportdetails werden nicht geloggt. |
| Ressourcen und Shutdown | `app.ts:313` sperrt Upgrades, entfernt den Handler, loescht Auth-Timer und terminiert alle registrierten WS-Verbindungen vor dem Schliessen des WS-Servers. Der Ablauf wartet nicht auf einen kooperativen Client-Close-Handshake. |
| Stack, Secrets und Scope | Keine Manifest-, Lockfile-, Dependency-, Vertrags- oder Frameworkaenderung. Node/TypeScript/Fastify/ws bleiben freigegeben. `.env` ist ignoriert; `.env.example` enthaelt nur lokale Beispielwerte/Platzhalter. Vorhandener Health-Aufruf und Vertragsvalidierung werden wiederverwendet; keine Inventarfaehigkeit dupliziert. |

## Gelesene Laufzeit-Evidence des Orchestrators

| Evidence unter `tasks/evidence/` | Tatsaechlich aufgezeichnetes Ergebnis |
| --- | --- |
| `FEAT-1-2026-10-26T14-40-11-514Z.json` | `npm --prefix apps/server test`, Exit 1: fuenf initiale Lobbytests scheitern fachlich am fehlenden POST-Endpunkt (404); 26 bestehende Tests gruen. |
| `FEAT-1-2026-10-26T14-56-49-639Z.json` | Derselbe Befehl, Exit 0: 34/34 Tests in sechs Dateien bestanden. Die acht gelesenen Lobbytests pruefen unter anderem alle Rollen, verbotenen Start durch Spieler/Projektor, falsches Token/unbekannte Sitzung ohne Snapshot, fremde Origin, fehlerhaftes JSON bei weiter verfuegbarem HTTP und Snapshotfilterung. |
| `FEAT-1-2026-10-26T14-56-56-859Z.json` | `npm --prefix apps/server run lint`, Exit 0: ESLint und `tsc --noEmit`. |
| `FEAT-1-2026-10-26T14-57-04-080Z.json` | `npm --prefix apps/server run build`, Exit 0. |

Diese Laeufe wurden vom Orchestrator ausgefuehrt, vom Security Reviewer gelesen
und nicht wiederholt. Maximalpayload, Auth-Timeout, Nachrichtengrenze, explizite
LAN-Konfiguration und Shutdown mit noch offenen Clients sind hier statisch
geprueft; ein eigener erfolgreicher Laufzeittest dafuer wird nicht behauptet.
Keine externen Scans, Dienstzugriffe oder UI-/Browserpruefungen durch diesen
Reviewer.

## Ausgefuehrte Befehle und Ergebnis

| Befehl | Ergebnis |
| --- | --- |
| `Get-Content -LiteralPath ... -Raw -Encoding UTF8`, `rg --files ...`, `rg -n ...` | Vorgaben, Task/Inventar, Contracts, Servercode, Tests, Dokumentation und alle vier Evidence-Dateien gelesen. |
| `git status --short --branch`, `git rev-parse HEAD`, `git log -1 --format=%H%n%s` | Finaler Stand bb8b683 auf FEAT-1; Arbeitsbaum vor dem Review-Artefakt sauber. |
| `git diff --stat main...FEAT-1`, `git diff --name-status main...FEAT-1`, `git diff main...FEAT-1 -- ...` | Vollstaendigen Task-Diff gegen main geprueft. |
| `git diff --check main...FEAT-1` | Exit 0. |

Geaenderte Datei: ausschliesslich `tasks/reviews/FEAT-1-security.md`.
Blocker nach Fehlerklasse (`code|werkzeug|umgebung|entscheidung`): keine.
