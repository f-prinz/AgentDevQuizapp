# Code Review TECH-4

Reviewer: `code_reviewer`, unabhaengig von `server_developer`.
Gepruefter Stand: `70dd8ed1ab350ebbdf7b0cf41d271eb891f60816`;
vollstaendiger Branch-Diff `main...TECH-4`: 23 Dateien einschliesslich
aller zehn Evidence-Dateien. Code, SQL, Seeds, Tests, Helper und Dokumentation
wurden gelesen; Implementierungsrationale wurde nicht als Evidenz verwendet.

Ergebnis: **freigegeben, keine offenen Findings oder Blocker**.

## Abgleich mit den Akzeptanzkriterien

| TECH-4-Kriterium | Ergebnis und konkreter Nachweis |
| --- | --- |
| Migrationen erzeugen Katalog-Tabellen | `001_games.sql` erzeugt `games` mit Primaerschluessel, Spielart-/Versions-Constraints und JSONB-Inhalt. Der Runner erzeugt `schema_migrations`, wendet nummerierte SQL-Dateien nur einmal an und verwendet dieselbe Transaktion wie die Seeds. Der gelesene PostgreSQL-Test prueft die beiden tatsaechlich erzeugten Tabellen und gleichbleibende Migrationszahl. |
| Beispielsets je Spielart beim Start laden | Drei Seed-Dateien enthalten Quiz mit zwei Fragen und vier Optionen je Frage, Sortieren mit eindeutigen Werten sowie Schaetzen mit endlichem Ziel. `GameSeedSchema` validiert alle Seeds und eindeutige Spiel-IDs vor dem ersten SQL-Zugriff. `main` startet ueber `startCatalogServer`; Migration, Upsert, vollstaendiges Lesen und Pool-Ende liegen vor `listen`. Der Bootstrap-Test prueft den geladenen Katalog und einen echten HTTP-Health-Aufruf. |
| Katalog-Abfrage liefert alle Spiele | `readCatalog` liest alle Zeilen; `initializeCatalog` liest auf demselben Client nach den Upserts und vor COMMIT ebenfalls den gesamten Katalog. Beide Wege validieren Inhalte sowie ID, Art, Titel, Regeln und Schemaversion. Der Regressionstest prueft einen nicht von Seeds verwalteten Eintrag im Initialisierungsrueckgabewert und dessen Erhalt bei wiederholtem Upsert. |

Aktuelle gruene Test-Evidence:
`tasks/evidence/TECH-4-2026-10-26T14-24-59-030Z.json`, Exit 0, **26/26 Tests**
in fuenf Dateien. Die Tests starten echte isolierte PostgreSQL-18-Cluster,
verwenden keine Anwendungsdatenbank und pruefen ausserdem unveraenderte Daten
bei ungueltigem Seed sowie Ablehnung korrupter gespeicherter Inhalte.
Der Reviewer hat die Suite nicht erneut ausgefuehrt. Wiederholte
Initialisierung/Idempotenz ist belegt; ein eigener kompletter Prozessneustart
wird durch dieses Review nicht als ausgefuehrter Test behauptet.

## Nachpruefung der waehrend PREP gemeldeten Befunde

- **Behoben: blocker, code**, `apps/server/src/catalog.ts:171`:
  Der urspruengliche Rueckgabewert enthielt nur Eingabe-Seeds; persistierte
  weitere Spiele fehlten und wurden beim Start nicht validiert.
  Fix: gesamten Datenbankkatalog innerhalb derselben Transaktion vor COMMIT
  lesen und validieren. Die rote Evidence
  `TECH-4-2026-10-26T14-21-47-768Z.json` zeigt genau die zwei semantischen
  Fehler fuer fehlenden Fremdeintrag und korrupte nicht seedverwaltete Zeile;
  die aktuelle gruene Suite deckt beide ab.
- **Behoben: blocker, code**, `apps/server/src/bootstrap.ts:26`:
  `pg` kann einen URL-Host ueber `?host=...` ueberschreiben. Der Reviewer
  reproduzierte ohne Netzwerkverbindung, dass eine als Loopback validierte
  URL im `pg.Client` den Host `example.invalid` ergibt.
  Fix: Queryparameter vor Pool-Erstellung vollstaendig abweisen.
  Regressionen pruefen normalen und percent-codierten Parameternamen sowie
  ausbleibenden Verbindungsversuch. Die rote URL-Evidence
  `TECH-4-2026-10-26T14-20-23-950Z.json` enthaelt beide erwarteten Fehler und
  zusaetzlich einen damaligen initdb-Umgebungsfehler; dieser Lauf wird nicht
  als sauberer roter Katalognachweis verwendet.

## Stack, Scope, Invarianten und Duplikation

`AGENTS.md`, `docs/agent-context.md`, `docs/tech-stack.md`, TECH-4 im Task-State,
MVP-Architektur/-Plan und die verwendeten Vertragsmodelle wurden abgeglichen.
Node >=24, TypeScript/ESM, `pg`/PostgreSQL mit SQL-Migrationen, Fastify,
Vitest und ESLint/tsc bleiben im freigegebenen Stack. Keine Dependency-,
Manifest-, Lockfile- oder Vertragsaenderung und keine Buchhaltungsdatei im Diff.
Produktionscode und Daten bleiben unter `apps/server/`; erlaubte Evidence
liegt unter `tasks/evidence/`. `.env.example` enthaelt Platzhalter.

Persistiert werden ausschliesslich Kataloginhalte und Migrationsmetadaten;
keine Lobby-, Sitzungs-, Ergebnis- oder Timerpersistenz. Timer-/Antwortregeln
werden nicht veraendert. SQL-Werte sind parametrisiert. Startfehler sind
bereinigt. Der Pool wird vor HTTP-Bereitschaft geschlossen und bei
fehlgeschlagenem Start ebenfalls beendet; damit verbleibt kein ungenutzter
Pool waehrend des ausschliesslich mit Katalogsnapshot arbeitenden Betriebs.
Seed-/Migrationspfade zeigen aus `src/` und `dist/` auf dieselben Assets.

Der PostgreSQL-Testhelper verwendet eigene temporaere Datenverzeichnisse
unter `apps/server/tmp/` und Loopback mit dynamischen Ports. Er prueft vor
rekursivem Entfernen den absoluten eigenen Pfad, stoppt nur den dazugehoerigen
Cluster und erhaelt Daten bei fehlgeschlagenem Stop. Toolausgaben gehen in
eigene Logdateien; Error-Cause-/Logtail-Pfade wurden ebenfalls gelesen.
Vorhandene Datenbankdienste werden vom Helper nicht angesprochen.

`docs/feature-inventory.md` referenziert: INV-1 ist der bestehende
Health-Aufruf. Dieser wird ueber `buildServer` wiederverwendet; keine
vorhandene Nutzerfaehigkeit dupliziert. `GameSeedSchema` wird aus dem
freigegebenen Vertrag importiert. Dieses Review belegt TECH-4,
keine fertigen Lobby-/Spielablaeufe oder ein vollstaendiges MVP.

## Tatsaechlich ausgefuehrte Befehle und Ergebnis

| Befehl | Ergebnis |
| --- | --- |
| `Get-Content` / `rg` fuer Vorgaben, Task, Inventar, Architektur, Contracts und alle betroffenen Dateien | Vollstaendig gelesen; der erste Versuch mit `docs/architecture.md` wurde auf die vorhandene `docs/feature-mvp-architecture.md` korrigiert. |
| `git status --short --branch`, `git rev-parse HEAD`, `git log main..TECH-4 --oneline` | Finaler Code-Stand 70dd8ed; Arbeitsbaum vor Review-Artefakt sauber auf TECH-4. |
| `git diff --stat main...TECH-4`, `git diff --name-status main...TECH-4`, `git diff main...TECH-4 -- apps/server/...`, `git diff main...TECH-4 -- tasks/evidence` | Gesamten Diff einschliesslich aller Evidence gelesen. |
| Read-only `node --input-type=module`-Probe mit `pg.Client` | URL-Host-Override ohne Netzwerkzugriff bestaetigt; anschliessend Fix und Regressionen gelesen. |
| `npm --prefix apps/server run lint` | Vom Reviewer vor und nach Fix ausgefuehrt; jeweils Exit 0, ESLint und `tsc --noEmit` gruen. |
| `git diff --check main...TECH-4` | Exit 0. |

Zusaetzlich gelesene aktuelle Evidence: Lint
`TECH-4-2026-10-26T14-25-06-987Z.json` und Build
`TECH-4-2026-10-26T14-25-11-986Z.json`, jeweils Exit 0.
Kein eigener erneuter Build. Fruehere rote und gruene Laeufe bleiben als
historische Evidence erhalten und ersetzen nicht den aktuellen Nachweis.

Geaenderte Datei durch den Reviewer: ausschliesslich `tasks/reviews/TECH-4.md`.
Keine Code-, Test- oder Task-State-Aenderung.
Offene Blocker nach Fehlerklasse (`code|werkzeug|umgebung|entscheidung`): keine.
