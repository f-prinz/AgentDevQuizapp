# Playbook: Bug

Eingehende Fehlerbehebung. Ziel: reproduzierter, minimalinvasiv behobener Fehler mit Regressionsschutz.

## Eingangskriterien
- Fehlerbeschreibung mit erwartetem vs. tatsaechlichem Verhalten (Vollformat fuer den Nutzer: `docs/templates/request-bug.md`). Fehlt das: geordnete Rueckfragenliste (Reproduktionsschritte, betroffene Komponente/Rolle, Umgebung) an den Nutzer — nicht raten.

## Ablauf
1. **Reproduzieren zuerst.** `bug_reproducer` erstellt ein reproduzierbares Szenario oder einen dokumentierten Repro-Schritt und lokalisiert die Root Cause (eine Zeile Diagnose + Datei:Zeile). Er aendert keinen Code. Kein Fix ohne nachgewiesene Reproduktion.
2. **Task anlegen.** `BUG-xxx` via `node scripts/add-task.mjs` (rote Evidence ist bei BUG Pflicht). AK: Reproduktionstest wird gruen, relevante Suite bleibt gruen. Abhaengigkeit: letzter DONE-Task des betroffenen Bereichs. `inventory_refs` verweist auf den betroffenen bestehenden INV-Eintrag; der Regressionstest wird als Anker dort ergaenzt (kein neuer Eintrag ohne neue Faehigkeit).
3. **Branch:** `update-task BUG-xxx IN_PROGRESS --by <komponente>_developer`, dann `node scripts/branch-task.mjs BUG-xxx`.
4. **Regressionstest (rote Evidence).** `<komponente>_test_engineer` formalisiert die Reproduktion als failing Test — muss aus dem richtigen Grund fehlschlagen: `node scripts/record-check.mjs BUG-xxx -- <testbefehl>` (Exit != 0).
5. **Fix.** `<komponente>_developer` behebt die Ursache im aktuellen Stack der Komponente (gruene Evidence; bei `lint_command` zusaetzlich Lint-Evidence). Keine Stack-Migration als Bugfix. Erfordert der Fix eine Designaenderung ausserhalb des Task-Scope: stoppen und eskalieren.
6. **Review + Merge:** `code_reviewer` auf dem Branch-Diff; Findings als `tasks/reviews/BUG-xxx.md` ablegen. Bei Auth-/Input-/URL-Bugs zusaetzlich `security_reviewer`. Bei Remote: `node scripts/push-task.mjs`; dann `node scripts/merge-task.mjs`. UI-Bug zusaetzlich: Browser-/E2E-Pruefung gemaess `docs/agent-context.md`.
7. **Abschluss:** finale Evidence auf main, dann `update-task.mjs BUG-xxx DONE --test-evidence <file> --red-evidence <file> [--lint-evidence <file>] --reviewed-by <agent> --review-result "<summary>"`; danach `node scripts/check-state.mjs` + `node scripts/check-inventory.mjs`.

## Eskalation
- Max. 3 gezielte Fix-Versuche je Bug. Jeden Versuch protokollieren: `node scripts/record-fix.mjs BUG-xxx "<Diagnose>"`.
- **Finding-Eskalation:** schlaegt ein Fix zu demselben Review-/Lint-Finding dreimal fehl — BLOCKED und dem Nutzer zur Entscheidung vorlegen (akzeptieren / Regel ausnehmen / manuell beheben).
- Wenn die Root Cause eine Grenze des aktuellen Stacks ist, `software_architect` eine Stack-Bewertung erstellen lassen; Umsetzung nur nach ausdruecklicher Nutzerfreigabe.
- Danach Status BLOCKED mit `--reason` (Diagnose, Hypothesen, naechster Schritt). Keine Endlosschleife.

## Ergebnisformat
Root Cause | geaenderte Dateien | ausgefuehrte Tests + Evidence-Datei(en) | Review-Status | verbleibende Risiken
