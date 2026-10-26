# Playbook: Feature

Neue Funktionalitaet: neue Aktionen, API-Endpunkte, Datenmodell- oder Verhaltensaenderungen. Der Eingang wird als User Story formuliert ("Als <Rolle> moechte ich <Ziel>, um <Nutzen>").

## Ablauf
0. **Klaerungsphase (Pflicht).** `analyst` liefert als erstes Ergebnis eine geordnete Rueckfragenliste (je Frage: Relevanz, Optionen, Default-Vorschlag) oder explizit "kein Klaerungsbedarf" mit Begruendung. Der Orchestrator spielt die Fragen an den Nutzer weiter; erst nach Antwort geht es weiter. Das Requirements-Dokument erhaelt den Abschnitt "Geklaerte Rueckfragen". Vollformat fuer den Nutzer: `docs/templates/request-feat.md`.
1. **Produktentscheidung.** `analyst`: User Story, MVP-Relevanz, Prioritaet. Kritische offene Geschaeftsentscheidungen anhalten und fragen – nicht raten.
2. **Requirements:** `analyst` formuliert, `analyst_validator` prueft adversarial (pruefen, nicht erweitern); Ergebnis unter `docs/feature-<name>-requirements.md`. Stack-Annahmen und Konflikte zu `docs/tech-stack.md` explizit erfassen. Referenziert die Anfrage einen Prototypen unter `docs/prototypes/` (HTML oder PNG): als Layout-Referenz einlesen — Platzhalter-Inhalte sind nicht verbindlich, Layout/Farben/Reihenfolge schon. Developer extrahiert spaeter DOM-Struktur und CSS Custom Properties daraus; die Farb-Variablen fliessen in das zentrale Theme-File der UI-Komponente.
3. **Architektur/Datenmodell:** `software_architect` und bei Bedarf `database_engineer` pruefen Impact auf Domaenenlogik, API-Vertrag und Client-Ausgaben. Verbindliche Stackbewertung: `KEEP`, `ADJUST`, `REPLACE` oder `BLOCKED - USER DECISION REQUIRED`. Ergebnis unter `docs/feature-<name>-architecture.md`.
4. **Planung:** `technical_planner` zerlegt in `FEAT-xxx`-Tasks via `node scripts/add-task.mjs` (AK, Testbefehl, `lint_command` falls in `docs/tech-stack.md` gesetzt, `red_evidence_required` ist bei FEAT Standard; Abhaengigkeiten via `--deps`). Planung nur gegen den zuletzt freigegebenen Stack; ausstehende Stackentscheidungen blockieren.
5. **Branch:** `update-task FEAT-xxx IN_PROGRESS --by <komponente>_developer`, dann `node scripts/branch-task.mjs FEAT-xxx` (synchronisiert main vorher, falls Remote). Alle Commits des Tasks laufen auf diesem Branch — Name = Task-ID.
6. **TDD — roter Test zuerst:** `<komponente>_test_engineer` schreibt den failing Test aus den AK und dokumentiert ihn als rote Evidence: `node scripts/record-check.mjs FEAT-xxx -- <testbefehl>` (Exit != 0). Erst dann implementiert `<komponente>_developer` (gruene Evidence via `record-check` mit Exit 0; bei `lint_command` zusaetzlich Lint-Evidence). Schnittstellenaenderungen laufen als CONTRACT_CHANGE-Tasks ueber `integration_engineer`. Keine unzulaessige Stack-Mischung.
7. **Review:** `code_reviewer` reviewed den Branch-Diff (`git diff main...FEAT-xxx`); bei neuen Eingaben/Endpunkten zusaetzlich `security_reviewer`. Findings werden als `tasks/reviews/FEAT-xxx.md` abgelegt (Pflicht vor DONE). Bei konfiguriertem Remote: `node scripts/push-task.mjs FEAT-xxx` zur Review-Einreichung.
8. **Merge:** `node scripts/merge-task.mjs FEAT-xxx` — verweigert bei vorhergesagten Konflikten (dann auf dem Task-Branch gegen main loesen und erneut versuchen).
9. **Inventar (Pflicht vor DONE):** `documentation_agent` pflegt `tasks/inventory.json` auf main via `node scripts/update-inventory.mjs` (Anker: test/route/file/ui_step; Route-Anker `--anchor "route:<file>::<METHOD PATH>"`). Orchestrator verlinkt via `update-task FEAT-xxx --add-inv INV-x`; danach `node scripts/check-inventory.mjs` und `node scripts/render-inventory.mjs`.
10. **Abschluss:** finale Evidence auf main (`record-check`), dann `update-task FEAT-xxx DONE --test-evidence <file> --red-evidence <file> [--lint-evidence <file>] --reviewed-by <agent> --review-result "<summary>"`. `documentation_agent` aktualisiert README/docs.

## Fast Path (kleine Features)

Kriterien: genau eine Komponente, kein CONTRACT_CHANGE, keine neue Dependency, kein neuer Endpunkt und keine Datenmodell-Aenderung, voraussichtlich <= 3 geaenderte Dateien. Trifft ein Kriterium nicht zu: normaler Ablauf.

Phasen bleiben identisch, Artefakte werden komprimiert:
- Ein Dokument `docs/feature-<name>.md` (Story + AK + Stack-Entscheidungsnotiz + geklaerte Rueckfragen) statt separater requirements-/architecture-Dateien.
- Ein `analyst`-Durchlauf ohne `analyst_validator`-Runde (die Klaerungsphase bleibt Pflicht).
- `technical_planner` darf den FEAT-Task inline in der Delegation liefern.
- NICHT aufgeweicht: Task mit AK + Testbefehl, Branch, roter+gruener Test mit Evidence, Lint-Evidence falls konfiguriert, Review, Inventar-Eintrag, Scope-Pruefung.

## Eskalation
- Max. 3 Fix-Retries je Task (`node scripts/record-fix.mjs`), dann BLOCKED mit `--reason` und Diagnose.
- **Finding-Eskalation:** schlaegt ein Fix zu demselben Review-/Lint-Finding dreimal fehl, wird nicht weiter probiert — BLOCKED und dem Nutzer zur Entscheidung vorgelegt (Finding akzeptieren / Lint-Regel ausnehmen / manuell beheben).
- Scope-Creep stoppen: neue Anforderungen waehrend der Umsetzung wandern als eigener Task in den Backlog, nicht in den laufenden Task.
- Empfohlene Stack-Abweichungen werden bis zur Nutzerentscheidung als `BLOCKED - USER DECISION REQUIRED` dokumentiert und nicht umgesetzt.

## Ergebnisformat
User Story | Tasks mit Status | ausgefuehrte Befehle + Evidence-Dateien | Reviews | nicht ausgefuehrte Pruefungen explizit
