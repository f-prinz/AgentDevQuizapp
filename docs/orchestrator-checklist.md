# Orchestrator-Checkliste

Kompakte Referenz zum periodischen Wiederlesen (z. B. nach Kontext-Kompaktierung
oder zwischen Tasks). Bindend sind AGENTS.md + die Playbooks; diese Seite ist
die Kurzfassung.

## Klassifikation

| Eingang | Typ | Playbook | Nutzer-Vorlage |
|---|---|---|---|
| Fehler im vorhandenen Verhalten | BUG | bug.md | `templates/request-bug.md` |
| Aenderung bestehender Funktion | CHANGE | change.md | `templates/request-chg.md` |
| Neue Funktionalitaet (User Story) | FEATURE | feature.md | `templates/request-feat.md` |
| Verstaendnisfrage | QUESTION | question.md | `templates/request-question.md` |
| Scaffolding, Contracts, Infrastruktur | TECH | tech.md | `templates/request-tech.md` |
| Meilenstein-/Inventar-Audit | AUDIT | audit.md | – |

Unklar → eine Rueckfrage statt raten. Jede BUG/CHANGE/FEATURE-Anfrage startet mit
der Klaerungsphase (analyst: Rueckfragenliste oder 'kein Klaerungsbedarf').

## Befehlssequenz pro Task

```
node scripts/sync-main.mjs                        # Session-Start + vor Branches
node scripts/add-task.mjs <ID> --component <c> --title "<t>"
    [--ak s] [--test s] [--lint s] [--deps "A,B"] [--scope p]*
    [--tdd|--no-tdd] [--deps-change]
node scripts/update-task.mjs <ID> IN_PROGRESS --by <agent>
node scripts/branch-task.mjs <ID>                 # Branch = Task-ID
# rot (nur red_evidence_required; FEAT/BUG immer):
node scripts/record-check.mjs <ID> -- <testbefehl>   # Exit != 0
# Implementierung, dann:
node scripts/record-check.mjs <ID> -- <testbefehl>   # Exit 0 (gruen)
node scripts/record-check.mjs <ID> -- <lintbefehl>   # Exit 0 (nur lint_command)
# Reviewer schreibt Findings: tasks/reviews/<ID>.md
node scripts/push-task.mjs <ID>                   # nur bei Remote
node scripts/merge-task.mjs <ID> [--keep]         # Konfliktprognose + Merge
# Inventar (FEAT/CHG/BUG Pflicht):
node scripts/update-inventory.mjs INV-x ...
node scripts/update-task.mjs <ID> --add-inv INV-x
node scripts/update-task.mjs <ID> DONE --test-evidence <f>
    [--red-evidence <f>] [--lint-evidence <f>]
    --reviewed-by <code_reviewer|security_reviewer> --review-result "<s>"
node scripts/check-state.mjs; node scripts/check-inventory.mjs
node scripts/archive-tasks.mjs                    # bei Meilenstein-Abschluss
node scripts/render-inventory.mjs
```

## Harte Gates (mechanisch erzwungen)

- Transitionen: TODO→IN_PROGRESS→DONE|BLOCKED; BLOCKED→IN_PROGRESS|TODO; DONE terminal
- Deps muessen DONE sein, bevor der Task startet
- DONE braucht: gruene Evidence (Exit 0, Befehl = test_command), rote Evidence
  (Exit != 0) falls red_evidence_required, Lint-Evidence (Exit 0) falls
  lint_command, tasks/reviews/<ID>.md, reviewed_by != implemented_by, bei
  FEAT/CHG/BUG mind. 1 inventory_ref, Scope sauber
- Branch = Task-ID; auf Task-Branches nur Code-Scope + tasks/evidence/ +
  tasks/reviews/; Buchhaltung (state.json, backlog.md, inventory.json,
  progress.md, feature-inventory.md) nur auf main
- Commits blockiert bei: Secrets im Diff, Dependency-Manifest ohne
  --deps-change, fremdem Branch, MAIN_ONLY-Dateien auf Task-Branch
- Merge blockiert bei vorhergesagten Konflikten → auf Task-Branch loesen
- backlog.md + feature-inventory.md nur generiert; state.json nur via Skripte
- Max. 3 Fix-Retries (record-fix.mjs) → BLOCKED + Nutzerentscheidung

## Eskalation an den Nutzer

Kritische Produktentscheidungen · Stack-Abweichung (BLOCKED - USER DECISION
REQUIRED) · selbes Finding 3x fehlgeschlagen · Merge-Konflikte, die der Agent
nicht sauber loest · divergierter main (Sync ff-only schlaegt fehl)
