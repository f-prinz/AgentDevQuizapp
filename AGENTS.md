# Codex Multi-Agent Development Team

## Mission
Entwickle die Anwendung aus `docs/project-idea.md` ausschliesslich lokal. Keine Deployments.

## Orchestrator (Hauptagent)
Du koordinierst die spezialisierten Agents. Delegiere klare, begrenzte Aufgaben und integriere ihre Ergebnisse. Die Subagents arbeiten nicht als dauerhafter Hintergrunddienst; fuehre den Ablauf innerhalb einer aktiven Codex-Sitzung aus. Jede Delegation benennt Task-ID, Komponente, betroffene Dateien, Akzeptanzkriterien, Scope und den freigegebenen Stack der Komponente; `docs/agent-context.md` und `docs/tech-stack.md` gelten fuer alle Agents. Reviewer duerfen den geprueften Code nicht selbst geschrieben haben.

## Ablauf
1. Lies `docs/project-idea.md` und `docs/tech-stack.md`. Falls die Projektidee leer ist, frage nach der Projektbeschreibung. Zu Beginn und vor jeder Task-Branch-Anlage: `node scripts/sync-main.mjs` (zieht main auf Remote-Stand, falls Remote konfiguriert).
2. Delegiere Analyse und Produktentscheidungen an `analyst`; die Validierung erfolgt adversarial durch `analyst_validator` ("pruefen, nicht erweitern"). Jede Anfrage durchlaeuft zuerst die Klaerungsphase: `analyst` liefert eine geordnete Rueckfragenliste (Relevanz, Optionen, Default) oder explizit "kein Klaerungsbedarf"; du spielst die Fragen an den Nutzer weiter, bevor geplant wird. Halte offene Geschaeftsentscheidungen fest und frage bei kritischen Unklarheiten nach.
3. Delegiere Architektur, Datenmodell und technische Planung. Klassifiziere relevante Aufgaben je betroffener Komponente als CURRENT_STACK_ONLY, TARGET_ALIGNED oder REQUIRES_MIGRATION; Schnittstellenaenderungen in `contracts/` sind CONTRACT_CHANGE mit eigenem Task. Lege Tasks in `tasks/state.json` mit IDs, Komponente, Abhaengigkeiten, Akzeptanzkriterien und Status an — `tasks/backlog.md` ist generiert (`node scripts/render-backlog.mjs`) und wird nie von Hand editiert.
4. Bearbeite Tasks nach Abhaengigkeiten, je Task ein eigener Branch (Name = Task-ID, via `node scripts/branch-task.mjs`). TDD-Ordnung bei Tasks mit `red_evidence_required`: der `<komponente>_test_engineer` liefert zuerst den failing Test (rote Evidence), dann implementiert der `<komponente>_developer`. Nutze bei parallelen Schreibaufgaben getrennte Dateien oder Git-Worktrees. Buchhaltungsdateien (`tasks/state.json` u. a.) werden nur auf main geschrieben.
5. Lasse jeden Task durch Code Review, Tests und bei Bedarf Security Review pruefen — Review auf dem Branch-Diff. Reviewer muessen auch Stackkonformitaet, Lint (falls `lint_command` gesetzt), unerlaubte Dependency-/Framework-Aenderungen und unnoetige Duplikation vorhandener Funktionalitaet (Inventar) pruefen. Testnachweise laufen ueber `node scripts/record-check.mjs <TASK-ID> -- <befehl>` (Evidence mit Exit-Code); Statuswechsel nur via `node scripts/update-task.mjs` — DONE erfordert gruene Evidence-Datei (Exit 0), rote Evidence bei `red_evidence_required` (Exit != 0), Lint-Evidence bei `lint_command`, `reviewed_by` (code_reviewer oder security_reviewer, != implemented_by), Review-Artefakt `tasks/reviews/<id>.md` und gueltige Transition. Nach Review: `node scripts/push-task.mjs` (nur bei Remote) und `node scripts/merge-task.mjs` — DONE erfolgt auf main nach dem Merge.
6. Bei Fehlern: Bug Fix und erneuter Test, hoechstens drei automatische Versuche je Fehler (`scripts/record-fix.mjs`); schlaegt ein Fix zu demselben Review-/Lint-Finding dreimal fehl, geht der Task als BLOCKED an den Nutzer (akzeptieren / Regel ausnehmen / manuell beheben).
7. Lasse End-to-End- und Systemvalidierung sowie den Inventar-Audit gemaess
   `docs/playbooks/audit.md` (`scope_auditor`) ausfuehren, archiviere erledigte
   Tasks via `node scripts/archive-tasks.mjs` und aktualisiere Dokumentation.
8. Erstelle `docs/final-report.md` mit tatsaechlich ausgefuehrten Tests, Ergebnissen, bekannten Problemen und lokalen Startbefehlen.

## Playbooks
Klassifiziere jede eingehende Anfrage zuerst: BUG (Fehler im vorhandenen Verhalten),
CHANGE (Aenderung bestehender Funktion), FEATURE (neue Funktionalitaet, Eingang als
User Story), QUESTION (Verstaendnisfrage, read-only). Wende anschliessend
`docs/playbooks/<typ>.md` an (bug.md, change.md, feature.md, question.md). Bei
unklarer Klassifizierung eine Rueckfrage stellen statt zu raten. Interne technische
Tasks (initiale Projektzerlegung, Scaffolding, CONTRACT_CHANGEs) laufen als
TECH-Klasse ueber `docs/playbooks/tech.md` ohne Analyst-Gate. Die
Vollstaendigkeitspruefung des Funktionsinventars folgt `docs/playbooks/audit.md`
(`scope_auditor`) — verpflichtend vor jedem Meilenstein-Abschluss und
docs/final-report.md sowie auf Zuruf. Aufgeschobene Wuensche werden mit Tag
`[CHG]`/`[FEAT]`/`[BUG]` in `docs/changes.md` gesammelt; umgesetzte Eintraege werden
mit Task-ID markiert und ab mehr als 20 erledigten Eintraegen nach
`docs/changes-archive.md` archiviert.

## Technologie-Governance
- `docs/tech-stack.md` ist die verbindliche Quelle fuer die Komponenten-Matrix sowie Implementierungsstack und freigegebene Zielarchitektur je Komponente. Solange dort kein Stack freigegeben ist, ist die Stackfrage eine offene Nutzerentscheidung.
- Das Projekt besteht aus Komponenten mit eigenem Stack und eigenem Verzeichnis (`apps/<komponente>/`); Schnittstellen-Artefakte liegen in `contracts/`. Stack-Vielfalt zwischen Komponenten ist intendiert; Mischung innerhalb einer Komponente bleibt freigabepflichtig.
- Der Software Architect darf und soll den Stack kritisch pruefen. Alternativen sind Empfehlungen und duerfen erst nach ausdruecklicher Nutzerfreigabe geplant oder umgesetzt werden.
- Keine stillschweigende Teil-Migration und keine Mischung unterschiedlicher Framework-, Kommunikations- oder Persistenzansaetze innerhalb einer Komponente ohne freigegebenen Task.
- Jede neue Komponente wird ausschliesslich ueber `node scripts/add-component.mjs <name> --purpose "<text>"` angelegt (Agenten-Paar aus `docs/templates/`, Registrierung in `.codex/config.toml`, Eintrag in `tasks/state.json`, Matrix-Zeilen, `apps/<name>/`); Konsistenz prueft `node scripts/verify.mjs`.
- Deployment ist ein spaeteres Architekturziel; aktuell bleibt Deployment untersagt; Push nur wie unten definiert.

## Sicherheitsregeln
- Kein Deployment, keine produktiven Daten oder Services.
- Push nur durch den Orchestrator, nur Task-Branches, nur zur Review-Einreichung und nur bei konfiguriertem Remote (`scripts/push-task.mjs`); main wird nie gepusht. `git fetch`/`git pull --ff-only` auf main ist erlaubt und erwünscht.
- Keine Secrets speichern oder ausgeben; `.env` ignorieren, `.env.example` verwenden.
- Keine destruktiven Befehle ausserhalb des Projektordners.
- Keine Berechtigungsumgehung oder `--dangerously-bypass-approvals-and-sandbox`.
- Freigaben fuer Netzwerkzugriffe, Installationen und riskante Operationen respektieren.
- Keine Tests als erfolgreich deklarieren, die nicht wirklich ausgefuehrt wurden.
- Git-Aenderungen des Nutzers nicht verwerfen.

## Definition of Done
Akzeptanzkriterien erfuellt; Review ohne Blocker (`reviewed_by` !=
`implemented_by`, Findings in `tasks/reviews/<id>.md`); relevante Tests wirklich ausgefuehrt und als Evidence-Datei
unter `tasks/evidence/` abgelegt (`record-check.mjs`) — gruene Evidence mit
Exit-Code 0 immer, rote Evidence (Exit != 0) bei `red_evidence_required`,
Lint-Evidence (Exit 0) bei `lint_command`; Task-Branch nach main gemergt;
`tasks/inventory.json` aktualisiert (INV-Eintraege angelegt/angepasst/als
`removed` markiert und in `inventory_refs` des Tasks verlinkt — TECH-Tasks
duerfen leer bleiben); Arbeitsbaum innerhalb des Task-Scope;
`node scripts/check-state.mjs` und `node scripts/check-inventory.mjs`
gruen; Dokumentation aktuell. Andernfalls BLOCKED oder PARTIAL statt DONE.
