# Playbook: Tech

Interne technische Tasks: initiale Projektzerlegung aus docs/project-idea.md, Scaffolding, Infrastruktur und CONTRACT_CHANGEs. Kein Analyst-Gate — die fachliche Entscheidung liegt bereits vor oder ist rein technisch.

Layout-Prototypen laufen ebenfalls als TECH-Task: `add-task TECH-x --component <ui-komp> --title "Prototyp <name>" --scope docs/prototypes/` — der `--scope`-Flag oeffnet `docs/prototypes/` (Standard-Scope waere nur `apps/<komp>/`). Ergebnis: self-contained HTML (+ optional PNG), der Nutzer prueft es im Browser vor der eigentlichen Implementierung. Kein Inventar-Eintrag noetig — Prototypen sind keine nutzerpruefbare Faehigkeit.

## Ablauf
1. **Task anlegen.** `TECH-xxx` via `node scripts/add-task.mjs` mit Abhaengigkeiten, AK und Testbefehl. `inventory_refs` darf leer bleiben — ausser der Task schafft eine nutzerpruefbare Faehigkeit, dann ist ein Inventar-Eintrag Pflicht. Scaffolding-Tasks, die Root-Dateien anfassen, bekommen expliziten Scope via `--scope`. `red_evidence_required` ist bei TECH Standard-aus; `--tdd` setzen, wenn der Task testbaren Code erzeugt.
2. **Stackregeln gelten.** `CURRENT_STACK_ONLY`, `TARGET_ALIGNED` oder `REQUIRES_MIGRATION` klassifizieren; bei `REQUIRES_MIGRATION` `software_architect` bewerten lassen und Nutzerfreigabe einholen, bevor geplant wird.
3. **CONTRACT_CHANGE:** Aenderungen an `contracts/` laufen ausschliesslich als eigene TECH-Tasks ueber `integration_engineer` (Komponente `contracts`, Scope `contracts/`), nie beilaeufig in einem anderen Task. Der mechanische Scope-Check blockiert contracts/-Aenderungen ausserhalb solcher Tasks.
4. **Branch + Implementierung:** `update-task TECH-xxx IN_PROGRESS`, `node scripts/branch-task.mjs TECH-xxx`, Umsetzung ueber die Developer der betroffenen Komponenten (`<komponente>_developer`); getrennte Dateien oder Worktrees bei parallelen Schreibaufgaben.
5. **Verifizierung:** relevante Suite via `record-check.mjs` (Evidence; bei `red_evidence_required` rot zuerst) + `node scripts/check-state.mjs` + `node scripts/check-inventory.mjs`.
6. **Review + Merge:** `code_reviewer`; Pflicht bei CONTRACT_CHANGE. Findings als `tasks/reviews/TECH-xxx.md` ablegen. Bei Remote `node scripts/push-task.mjs`; dann `node scripts/merge-task.mjs` und Abschluss auf main.

## Eskalation
- Max. 3 Fix-Retries (`node scripts/record-fix.mjs`), danach BLOCKED mit `--reason` und Diagnose.
- **Finding-Eskalation:** schlaegt ein Fix zu demselben Review-/Lint-Finding dreimal fehl — BLOCKED und dem Nutzer zur Entscheidung vorlegen (akzeptieren / Regel ausnehmen / manuell beheben).
- Empfohlene Stack-Abweichungen werden als `BLOCKED - USER DECISION REQUIRED` dokumentiert und nicht umgesetzt.

## Ergebnisformat
Task | geaenderte Dateien | ausgefuehrte Befehle + Ergebnisse | Review | offene Punkte
