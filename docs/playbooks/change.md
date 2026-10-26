# Playbook: Change

Aenderung an bestehender Funktionalitaet (z. B. Eintraege aus docs/changes.md). Kein neues Feature, kein Bug.

## Ablauf
0. **Klaerungsphase (Pflicht).** `analyst` liefert je Punkt als erstes Ergebnis eine geordnete Rueckfragenliste (Relevanz, Optionen, Default) oder explizit "kein Klaerungsbedarf" mit Begruendung; der Orchestrator spielt sie an den Nutzer weiter. Vollformat fuer den Nutzer: `docs/templates/request-chg.md`.
1. **Quelle lesen** (docs/changes.md o. ae.). Jede Aenderung als eigenen Punkt behandeln.
2. **Requirements:** `analyst` formuliert je Punkt eindeutige Akzeptanzkriterien; `analyst_validator` prueft adversarial auf Widersprueche zu bestehendem Verhalten (pruefen, nicht erweitern). Unklare Produktentscheidungen: anhalten und fragen.
3. **Stackcheck:** `docs/tech-stack.md` anwenden und den Punkt als `CURRENT_STACK_ONLY`, `TARGET_ALIGNED` oder `REQUIRES_MIGRATION` klassifizieren. Bei `REQUIRES_MIGRATION` oder gewuenschter Stack-Abweichung `software_architect` bewerten lassen und vor Planung Nutzerfreigabe einholen.
4. **Planung:** `technical_planner` legt `CHG-xxx`-Tasks via `node scripts/add-task.mjs` an (Abhaengigkeiten, AK, Testbefehl, `lint_command` falls gesetzt, `inventory_refs` auf die betroffenen INV-Eintraege). **TDD-Flag:** aendert der Punkt Verhalten, `--tdd` setzen (rote Evidence Pflicht); reine Refactorings ohne Verhaltensaenderung ohne Flag (gruene Suite reicht). Kleine UI-Punkte duerfen gebuendelt werden, wenn sie dieselben Dateien/Testbefehle teilen.
5. **Branch + Umsetzung:** `update-task CHG-xxx IN_PROGRESS --by <komponente>_developer`, `node scripts/branch-task.mjs CHG-xxx`. Bei `red_evidence_required`: `<komponente>_test_engineer` liefert zuerst den failing Test (rote Evidence); dann Implementierung durch `<komponente>_developer` (gruene + ggf. Lint-Evidence). Schnittstellen in `contracts/` als eigene `TECH`-Tasks (CONTRACT_CHANGE) ueber `integration_engineer`. Vorher- vs. Nachher-Verhalten im Task festhalten.
6. **Review + Merge:** `code_reviewer` auf dem Branch-Diff; Findings als `tasks/reviews/CHG-xxx.md` ablegen. Bei Server-/API-Inputverarbeitung zusaetzlich `security_reviewer`. Bei Remote: `node scripts/push-task.mjs`; dann `node scripts/merge-task.mjs` (Konfliktprognose inklusive). Nicht freigegebene Stack-Abweichungen sind Reviewblocker.
7. **Inventar (Pflicht vor DONE):** `documentation_agent` aktualisiert `tasks/inventory.json` auf main via `node scripts/update-inventory.mjs` — geaenderte Faehigkeit: Anker anpassen; entfernte Faehigkeit: Status `removed` + `removed_by` (Eintrag bleibt erhalten); Orchestrator verlinkt via `update-task --add-inv`; danach `node scripts/check-inventory.mjs` und `node scripts/render-inventory.mjs`.
8. **Abschluss:** finale Evidence auf main, dann `update-task CHG-xxx DONE` mit den passenden Evidence-Flags.

## Fast Path

Kleine Changes (ein Punkt, eine Komponente, kein CONTRACT_CHANGE, <= 3 Dateien) duerfen wie im Fast Path von `docs/playbooks/feature.md` komprimiert werden: kombiniertes Kurzdokument, ein `analyst`-Durchlauf ohne `analyst_validator` (Klaerungsphase bleibt). Tests mit Evidence, Review, Inventar-Pflege und Branch-Workflow bleiben Pflicht.

## Eskalation
- Max. 3 Fix-Retries (`node scripts/record-fix.mjs`), danach BLOCKED mit `--reason` und Diagnose.
- **Finding-Eskalation:** schlaegt ein Fix zu demselben Review-/Lint-Finding dreimal fehl — BLOCKED und dem Nutzer zur Entscheidung vorlegen (akzeptieren / Regel ausnehmen / manuell beheben).
- Eine Aenderung, die sich als Feature herausstellt (neue Aktionen, Datenmodell, API), wird nicht hier implementiert, sondern als FEATURE neu eingesteuert.

## Ergebnisformat
Je Punkt: Status (DONE/BLOCKED) | AK erfuellt ja/nein | Tests + Evidence | Inventar-Eintraege (INV-xxx) | Review | Abweichungen vom urspruenglichen Wunsch
