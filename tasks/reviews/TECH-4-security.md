# TECH-4 Security Review

Reviewer: `security_reviewer`; Datum: 2026-10-26.
Gepruefter Stand: `70dd8ed`, Branch-Diff `main...TECH-4`.
Ergebnis: **APPROVED – keine offenen Security-Findings**.

## Scope und Regeln

Gelesen: `AGENTS.md`, `docs/agent-context.md`, `docs/tech-stack.md`,
`docs/project-idea.md`, `docs/feature-mvp-architecture.md`, TECH-4 in
`tasks/state.json` sowie der Server-Diff mit Migration, Seeds und Testfixture.
Freigegebener Stack bleibt Node.js >=24, TypeScript/ESM, Fastify, pg und
PostgreSQL mit SQL-Migrationen. Keine Dependency-, Framework- oder
Contract-Aenderung im geprueften Diff. Der Reviewer hat keinen Anwendungscode
dieses Tasks geschrieben.

## Findings und Nachpruefung

- **P1, behoben – `apps/server/src/bootstrap.ts:23`:** Der erste Stand pruefte
  nur den URL-Authority-Host. `pg` kann diesen durch den Queryparameter `host`
  ueberschreiben. Eine lokale Parser-Reproduktion ohne Verbindungsaufbau zeigte
  fuer `postgresql://127.0.0.1/test?host=example.invalid` einen erlaubten
  Validator-Host und den effektiven pg-Host `example.invalid`. Fixvorschlag war,
  Queryoptionen vor dem Pool-Aufbau abzuweisen. Der finale Stand setzt dies mit
  `parsed.search !== ''` um. Dadurch werden auch encodierte Hostschluessel und
  die dateilesenden pg-SSL-Queryoptionen ausgeschlossen. Die Regressionen in
  `apps/server/test/bootstrap-url.test.ts` pruefen plain/encodierten Host und
  dass `Pool.connect` nicht aufgerufen wird.
- **P2, behoben – `apps/server/src/bootstrap.ts:49`:** Ein nach dem einmaligen
  Katalogladen offen gehaltener Pool konnte bei einem spaeteren Idle-Client-
  Fehler ein unbehandeltes Pool-Fehlerereignis erzeugen. Der finale Stand
  schliesst den Pool nach dem validierten Readback und vor `app.listen`.
  Damit bleibt nach Bereitschaft keine Laufzeit-Datenbankverbindung bestehen.
  Nachpruefung statisch; kein Datenbankausfall wurde vom Reviewer erzeugt.

## Gepruefte Vertrauensgrenzen

- SQL-Datenwerte und Migrationsmarker sind parametrisiert. Direkt ausgefuehrtes
  Migrations-SQL stammt ausschliesslich aus festen komponentenlokalen Dateien.
- Alle Seeds werden vor der Verbindung bzw. vor Schreibvorgaengen mit dem
  strikten gemeinsamen `GameSeedSchema` validiert; doppelte Spiel-IDs werden
  abgewiesen. Migrationen, Upserts und vollstaendiger validierter Readback
  laufen ueber denselben Transaktionsclient vor `COMMIT`
  (`apps/server/src/catalog.ts:168`). Fehler fuehren zu Rollback und Release.
- Datenbankinhalte werden hinsichtlich Schema und Metadatenkonsistenz geprueft;
  fremde gueltige Katalogeintraege bleiben erhalten und werden mitgeladen.
  Persistiert werden nur `games` und `schema_migrations`, keine Sessions,
  Tokens, Antworten oder Ergebnisse.
- Startup-Fehler nach Pool-Aufbau werden bereinigt; `main.ts` gibt nur eine
  konstante Fehlermeldung aus. `.env.example` enthaelt einen Platzhalter,
  `.env` ist ignoriert. Keine echten Secrets im geprueften Diff festgestellt.
- Keine neue HTTP-/WS-Route und keine Ausgabe des loesungshaltigen Katalogs an
  Clients. Rollenautorisierung und Rendering von Nutzerdaten sind durch diesen
  Task nicht erweitert; eine neue rollenbezogene Laufzeitpruefung entfaellt.
- Die PostgreSQL-Testfixture erstellt ein eigenes `mkdtemp`-Verzeichnis unter
  `apps/server/tmp`. Absolute direkte Kindpfade werden vor rekursivem Entfernen
  geprueft. `pg_ctl` nutzt ausschliesslich dieses eigene `-D`; vorhandene Dienste
  werden nicht umkonfiguriert. Trust-Authentifizierung bleibt auf dem an
  `127.0.0.1` gebundenen privaten Testcluster. Bei fehlgeschlagenem Stop bleibt
  das Verzeichnis erhalten. Die begrenzten Diagnose-Logauszuege stammen aus
  diesem Testcluster ohne Anwendungs-Verbindungsstring oder Passwort.

## Ausgefuehrte Befehle und Ergebnisse

Vom Reviewer selbst ausgefuehrt:

| Befehl | Ergebnis |
| --- | --- |
| `Get-Content -LiteralPath ... -Raw -Encoding UTF8` fuer Regeln, Architektur, State, Serverdateien, installierten pg-Parser und Evidence | Inhalte gelesen. Ein anfangs angefragtes `docs/architecture.md` existierte nicht; anschliessend das vorhandene `docs/feature-mvp-architecture.md` gelesen. |
| `rg --files ...`, `rg -n ...` | Scope, Schemavalidierung, Fehlerausgaben, Pool- und Fixture-Lifecycle statisch nachvollzogen. |
| `git status --short --branch`, `git diff -- apps/server`, `git diff --name-only main`, `git diff main...TECH-4 -- apps/server`, `git diff --name-only main...TECH-4`, `git show --stat --oneline 70dd8ed` | Finaler Code-Stand und Branch-Diff gelesen; Arbeitsbaum vor dem Review-Artefakt sauber. |
| `node --input-type=module -e "...new Client({ connectionString: databaseUrl })..."` in `apps/server` | Lokale Parser-Reproduktion des urspruenglichen Host-Overrides; kein `connect` aufgerufen, kein Dienstzugriff. |

Gelesene, vom Orchestrator ausgefuehrte Evidence, keine eigenen Wiederholungen:

| Evidence | Ergebnis |
| --- | --- |
| `tasks/evidence/TECH-4-2026-10-26T14-24-59-030Z.json` | `npm --prefix apps/server test`: Exit 0, 5 Dateien, 26/26 Tests bestanden; umfasst PostgreSQL-Integration und URL-Regressionen. |
| `tasks/evidence/TECH-4-2026-10-26T14-25-06-987Z.json` | `npm --prefix apps/server run lint`: ESLint und TypeScript, Exit 0. |
| `tasks/evidence/TECH-4-2026-10-26T14-25-11-986Z.json` | `npm --prefix apps/server run build`: Exit 0. |

Keine externen Scans, Installationen oder Dienstzugriffe durch den Reviewer.
Geaenderte Dateien: ausschliesslich `tasks/reviews/TECH-4-security.md`.
Blocker: keine (`code`, `werkzeug`, `umgebung`, `entscheidung`).
