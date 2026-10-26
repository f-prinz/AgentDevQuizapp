# TECH-6 Review

Reviewer: `code_reviewer`; Datum: 2026-10-26.
Geprueft: vollstaendiger Diff `main...TECH-6`, HEAD
`c9f88b1528f079412d7b1a7c5ce7551f23def9de`.

## Ergebnis

**Nachpruefung: Code freigegeben, keine offenen Code-Findings.** Die initialen
Findings unten bleiben als Reviewhistorie erhalten; ihre Behebung und die
erneuten Pruefungen sind im Abschnitt Nachpruefung dokumentiert. Eine vom
Orchestrator gemeldete externe Dateiaenderung ist davon getrennt zu klaeren;
dieses Review genehmigt keine Aenderungen ausserhalb des Task-Scope.

Die Metadatenpflege, virtuelle Vertragskomponente
und Klassifikation bleiben im Node-24-/ESM-Werkzeugstack; keine Dependencies,
Frameworks, Anwendungskomponenten oder Inventardateien werden geaendert.
Die bisherige zentrale Evidence-/Reviewer-/Transitionpruefung wurde nicht
entfernt.

## Initiale Findings (in der Nachpruefung behoben)

1. **blocker**, `scripts/selftest.mjs:249`: Das `process.exit(...)` im
   `finally` ersetzt eine unerwartete Exception im `try` durch Exit 0,
   solange zuvor keine mit `expect` registrierte Pruefung fehlgeschlagen ist.
   Die gespeicherte npm-test-Evidence mit 21 bestandenen Tests endet bereits
   vor Manifest-, TDD-, DONE-, Merge- und Archivpruefungen und beweist daher
   nicht deren Bestehen. Fix: unerwartete Exceptions mit Diagnose als Fehler
   behandeln und den Abschlusscode so setzen, dass sie nicht verschluckt
   werden; Regression fuer eine injizierte Exception ergaenzen. Auch wenn
   der Defekt vorbesteht, wird dieser Harness im Task geaendert und als
   Nachweis fuer erhaltene Workflowgates verwendet.
2. **blocker**, `scripts/update-task.mjs:61` und
   `scripts/lib/task-metadata.mjs:17`: `--title ''` wird als neue
   Planungsmetadaten akzeptiert; der gemeinsame Validator prueft den Titel
   nicht. Dadurch werden State und generierte Dateien geschrieben, obwohl
   `check-state.mjs` anschliessend den leeren Titel ablehnt. Fix: Pflichtfelder
   der veraenderten Taskdefinition vor jedem Schreiben validieren und den
   leeren Titel als atomaren Negativfall testen.
3. **blocker**, `scripts/add-task.mjs:25`: Der Parser akzeptiert ein folgendes
   `--...`-Token als Wert. Beispielsweise kann `--title --mystery` als Titel
   `--mystery` verarbeitet und gespeichert werden, statt das unbekannte bzw.
   unvollstaendige Flag abzuweisen. Das widerspricht dem AK zur Ablehnung
   ungueltiger Flags ohne Zustandsaenderung. Fix: fehlende/flagartige Werte
   wie bei update-task vor der Zuweisung abweisen und Negativtest fuer
   verschluckte Flags ergaenzen; leere explizite --deps-Werte weiter erlauben.
4. **minor**, `scripts/update-task.mjs:8`: Die Usage-Ausgabe dokumentiert
   die neuen Metadatenflags nicht. Fix: --component/--title/--ak/--test/
   --lint/--deps/--classification/--priority ergaenzen.

## Tatsaechliche Pruefungen

- Dateilekture von `docs/agent-context.md`, `docs/tech-stack.md`, Task-AK
  und `docs/feature-inventory.md`; vollstaendiger Branch-Diff aller
  geaenderten Skripte, neuer Tests und Evidence gelesen.
- `node --test test/task-metadata.test.mjs`: Exit 0, 5 Tests bestanden.
  Die positiven Pfade und vorhandenen atomaren Negativfaelle sind gruen;
  oben genannte Randfaelle werden noch nicht abgedeckt.
- Diagnose ohne Projektdateiaenderung:
  `node --import "data:text/javascript,process.exit = code => { process.exitCode = code; }" scripts/selftest.mjs`.
  Der Abschluss mit process.exit wurde nur im laufenden Diagnoseprozess
  ersetzt. Dieser Lauf erreichte alle 62 Pruefungen, meldete 61 bestanden
  und einen Fehler bei check-state pristine und endete mit Exit 1. Die
  einzelne fehlgeschlagene Pruefung gab keinen weiteren Output aus; dies
  wird nicht als gruener Selftest gewertet. Der Befund zum Verschlucken von
  Exceptions folgt zusaetzlich direkt aus dem vollstaendig gelesenen Code
  und der gespeicherten vorzeitig endenden 21-Test-Evidence.
- `git diff --check main...TECH-6`: Exit 0.
- Kein verpflichtender Lintbefehl fuer den Toolingtask (`lint_command: null`).
  Kein ESLint-, Browser-, Anwendungs- oder DB-Erfolg behauptet.

Das Inventar enthaelt weiterhin keine Produktfaehigkeiten; es wurde keine
bestehende Faehigkeit dupliziert. Die neue Validierung ist gemeinsam genutzt.
Die beiden Validierungsreports und frueheren Planungsartefakte wurden in
diesem Task nicht geaendert.

Geaenderte Datei: ausschliesslich `tasks/reviews/TECH-6.md`.
## Nachpruefung der Korrekturen

Geprueft wurde zusaetzlich zum committed Branch-Diff der vollstaendige noch
nicht committete Fixdiff in add-task, update-task, task-metadata, selftest
und task-metadata.test. Keine Codeaenderung durch den Reviewer.

- Finding 1 behoben: unerwartete Fehler werden im catch als Fehler registriert
  und mit Stack ausgegeben. Fehler beim Cleanup werden ebenfalls registriert.
  Der Abschluss setzt `process.exitCode` und verschluckt keine Exception.
  Die injizierte Sentinel-Exception prueft tatsaechlich den vorher defekten
  Pfad; sie endet nun sichtbar und ungleich null.
- Finding 2 behoben: der zentrale Validator lehnt leere und ausschliesslich
  aus Leerzeichen bestehende Titel vor Schreibzugriffen ab. Der Negativtest
  stellt unveraenderte Buchhaltungsdateien sicher.
- Finding 3 behoben: add-task weist flagartige Werte vor ihrer Zuweisung ab;
  der bisher verschluckte `--title --mystery`-Fall wird atomar getestet.
- Finding 4 behoben: die Usage-Ausgabe enthaelt die neuen Metadatenflags.

Tatsaechlich erneut ausgefuehrt:

- `node --test test/task-metadata.test.mjs`: Exit 0, **6/6 bestanden**,
  einschliesslich atomarer Titel-/Flag-Ablehnung und Exception-Sentinel.
- `npm test`: Exit 0, **62/62 bestanden**. Der Lauf erreichte explizit
  Manifest-, TDD-, Evidence-, DONE-, Merge-, Remote-, Inventar- und
  Archivpruefungen bis zum finalen check-state/check-inventory; kein
  vorzeitiger 21-Test-Abschluss.
- `git diff --check`: Exit 0 (nur Zeilenende-Hinweise).
- Die aktuelle root-Evidence
  `tasks/evidence/TECH-6-2026-10-26T12-55-58-766Z.json` wurde gelesen:
  Exit 0 mit 6 bestandenen gezielten Tests. Ein frueherer Exit-0-Lauf mit
  nur 21 Pruefungen bleibt als unzureichender historischer Nachweis erkennbar.

Offene Codeblocker: keine. Der gemeldete externe Scope-Sachverhalt bleibt
der Klaerung durch den Orchestrator vorbehalten; im von mir zuletzt gelesenen
`git status` waren keine geloeschten Dokumente aufgefuehrt.
