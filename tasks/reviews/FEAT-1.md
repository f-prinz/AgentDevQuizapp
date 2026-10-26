# Code Review FEAT-1

Reviewer: `code_reviewer`, unabhaengig von `server_developer`.
Gepruefter Commit: `bb8b68375abecb60c46ca2d94458f56f5ac5ecbd`.
Vollstaendiger Branch-Diff `main...FEAT-1` gelesen: sechs Serverdateien und
vier Evidence-Dateien. Grundlage sind Diff, Task-Akzeptanzkriterien,
`AGENTS.md`, `docs/agent-context.md`, `docs/tech-stack.md`,
MVP-Anforderungen/-Architektur/-Plan und die bestehenden Contracts.
Die Implementierungsrationale wurde nicht als Evidenz verwendet.

Ergebnis: **freigegeben; keine offenen Findings oder Blocker**.

## Konkreter Kriterienabgleich

| FEAT-1-Kriterium | Nachweis im gelesenen Code und Test |
| --- | --- |
| Eindeutige Lobby-ID und Rollen-Links | `lobby.ts:89` erzeugt kryptographisch zufaellige UUIDs, getrennte Host-/Projektorsitzungen und einen oeffentlichen Spielerlink. Geheimnisse liegen ausschliesslich in Linkfragmenten. Der Erstellungstest prueft unterschiedliche Lobbys, Sitzungen und die drei Linkformen. |
| Unbegrenzte Spielerzahl | `lobby.ts:119` fuegt Spieler ohne Kapazitaetsgrenze oder Maximalzahl-Konfiguration hinzu. Der Integrationstest tritt mit acht Spielern bei; dies prueft die fruehere kleine Lobbygroesse, nicht unendliche technische Kapazitaet. |
| Namen maximal 20 Zeichen; Default Spieler N | REST und WS verwenden die bestehenden Vertragsschemas; `lobby.ts:123` und `lobby.ts:182` validieren getrimmte Namen ebenfalls mit `NameSchema`. Der Snapshot verwendet fuer leere Namen die stabile Beitrittsnummer. Der Test prueft 20 Zeichen, Ablehnung von 21 und `Spieler 2`. |
| Start erst ab mindestens zwei Spielern | `lobby.ts:165` prueft Hostrolle, Phase und Spieleranzahl vor der Aenderung nach `overview`; `canStartLobby` verwendet dieselbe Schwelle. Integrationstests weisen Starts mit null/einem Spieler sowie durch Spieler/Projektor ab und bestaetigen den Hoststart mit zwei. |
| Host ist kein Spieler | Die Erstellung legt nur Rollen-Sitzungen an; ausschliesslich `joinPlayer` erweitert `players`. Snapshots projizieren nur dieses Array. Die Teilnehmerlisten-Tests pruefen die acht beigetretenen Spieler ohne Host. |

Host und Spieler erhalten ihre Teilnehmerlisten aus derselben Projektion.
Namensaenderungen sind an die authentifizierte Spieleridentitaet gebunden;
Host und Projektor erhalten dabei `FORBIDDEN`.

## Stack, Invarianten, Scope und Inventar

Der Diff bleibt beim freigegebenen Node-/TypeScript-/ESM-, Fastify-, `ws`-,
Vitest- und ESLint/tsc-Stack. Keine Dependency-, Manifest-, Lockfile- oder
`contracts/`-Aenderung; keine fremde Komponente oder verbotene Buchhaltungsdatei.
Produktionscode speichert Lobbys und Sitzungen ausschliesslich in Prozess-Maps.
Timer-/Antwortannahmeregeln werden nicht implementiert oder veraendert.

Sitzungstokens besitzen 256 Bit Zufallsentropie; gespeichert werden nur SHA-256-
Hashes, verglichen mit `timingSafeEqual`. Rollen werden aus der gespeicherten
Sitzung gebunden. WS prueft Schema, Origin, Payloadgroesse und Nachrichtenrate;
Auth-Timeout, Transportfehler, Verbindungszaehler und Shutdown-Cleanup wurden
gelesen. Snapshots projizieren Katalogmetadaten und geben weder Seed-Loesungen
noch Sitzungstokens aus. Fehler enthalten feste bereinigte Meldungen.

`docs/feature-inventory.md` referenziert: INV-1 (Health) bleibt bestehen;
INV-2 (PostgreSQL-Katalog laden) wird ueber den vorhandenen, vor `listen`
dekorierten Katalog wiederverwendet. Die Lobbyprojektion dupliziert keine
bestehende Nutzerfaehigkeit. `ALLOWED_ORIGINS` ist im finalen Diff in
Server-README und `.env.example` dokumentiert; der PREP-Dokumentationspunkt
ist damit erledigt.

Gameplay und die eigene Resume-Abnahme gehoeren zu spaeteren Tasks.
Nicht implementierte Spielbefehle liefern derzeit `INVALID_PHASE`.
Dieses Review beansprucht keine UI-/Browser- oder vollstaendige MVP-Abnahme.

## Ausgefuehrte Befehle und gelesene Evidence

| Vom Reviewer ausgefuehrter Befehl | Ergebnis |
| --- | --- |
| `Get-Content` und `rg` fuer Regeln, Task, Anforderungen, Architektur, Plan, Contracts, Inventar und betroffene Dateien | Gelesen; anfangs nicht vorhandene Kurzpfade requirements.md/architecture.md durch die vorhandenen feature-mvp-Dateien ersetzt. |
| `git status --short --branch`, `git log -3 --oneline`, `git rev-parse FEAT-1` | Finaler Stand bb8b683; vor Review-Artefakten sauberer Arbeitsbaum auf FEAT-1. |
| `git diff --stat main...FEAT-1`, `git diff --numstat main...FEAT-1`, dateigruppenweise `git diff main...FEAT-1 -- ...` | Gesamten Diff einschliesslich aller vier Evidence-Dateien gelesen. |
| `npm --prefix apps/server run lint` | Eigener Reviewer-Lauf: ESLint und `tsc --noEmit` gruen, keine Findings. |
| `git diff --check main...FEAT-1` | Keine Whitespacefehler. |

Die gelesene rote Evidence `FEAT-1-2026-10-26T14-40-11-514Z.json`
enthaelt fuenf fachliche 404-Fehler bei noch fehlenden Lobbyrouten und
26 bestandene bestehende Tests. Aktuelle Evidence:

- `FEAT-1-2026-10-26T14-56-49-639Z.json`: Exit 0, **34/34 Tests** in sechs
  Dateien, einschliesslich acht Lobbytests und PostgreSQL-Integration.
- `FEAT-1-2026-10-26T14-56-56-859Z.json`: Lint, Exit 0.
- `FEAT-1-2026-10-26T14-57-04-080Z.json`: Build, Exit 0.

Test-/Build-Evidence wurde gelesen; der Reviewer hat diese Befehle nicht
erneut ausgefuehrt. Lint wurde unabhaengig selbst ausgefuehrt.

Geaenderte Datei durch den Reviewer: ausschliesslich `tasks/reviews/FEAT-1.md`.
Offene Blocker nach Fehlerklasse (`code|werkzeug|umgebung|entscheidung`): keine.
