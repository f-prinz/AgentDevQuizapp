# Task-Templates

Wie Tasks aussehen, wer sie ausfuehrt und welche Nachweise sie brauchen.
Tasks werden ausschliesslich via `node scripts/add-task.mjs` angelegt;
`tasks/state.json` ist die einzige Wahrheit, `tasks/backlog.md` wird generiert.

## Was du als Nutzer liefern solltest

Fertige Vorlagen unter `docs/templates/request-*.md` — kopieren, ausfuellen,
einreichen (oder als strukturierter Eintrag in `docs/changes.md`).

| Typ | Dein Input | Vorlage | Beispiel |
|---|---|---|---|
| FEAT | User Story: "Als <Rolle> moechte ich <Ziel>, um <Nutzen>" | `docs/templates/request-feat.md` | "Als Admin moechte ich Nutzer deaktivieren, um Zugaenge zu sperren" |
| BUG | Erwartetes vs. tatsaechliches Verhalten + Repro-Schritte + Umgebung | `docs/templates/request-bug.md` | "Speichern wirft 500 statt Liste zu laden; Schritte: …; Browser: …" |
| CHG | Aufzaehlung der gewuenschten Aenderungen, Ist → Soll pro Punkt | `docs/templates/request-chg.md` | "- Ist: aufsteigend → Soll: absteigend" |
| TECH | intern (Scaffolding, Contracts, Prototypen) — meist vom Prozess erzeugt | `docs/templates/request-tech.md` | – |
| QUESTION | Verstaendnisfrage, kein Code | `docs/templates/request-question.md` | "Was passiert bei …" |

Unvollstaendige Inputs loesen die Klaerungsphase aus: der Analyst stellt
Rueckfragen (mit Optionen und Default-Vorschlag), bevor geplant wird.

## Felder eines Tasks

| Feld | Pflicht | Bedeutung |
|---|---|---|
| `id` | ja | `<TECH\|BUG\|CHG\|FEAT>-<n>`, zugleich Branch-Name |
| `component` | ja | eine Komponente aus `state.json.components` (`contracts` fuer CONTRACT_CHANGE) |
| `title` | ja | kurze Aufgabenbeschreibung |
| `acceptance_criteria` | ja (praktisch) | messbare Abnahmekriterien |
| `test_command` | ja (praktisch) | Befehl fuer die gruene Evidence |
| `lint_command` | nein | Lint-Befehl; gesetzt → `lint_evidence` Pflicht (Exit 0) |
| `red_evidence_required` | auto | TDD: rote+gruene Evidence. Standard `true` bei FEAT/BUG, `false` bei CHG/TECH; steuerbar via `--tdd`/`--no-tdd` |
| `dependencies` | nein | Task-IDs, die zuerst DONE sein muessen |
| `allowed_paths` | nein | expliziter Scope (Standard: `apps/<komp>/` bzw. `contracts/`) |
| `allows_dep_change` | nein | `--deps-change`: erlaubt Dependency-Manifest-Aenderungen auf dem Branch |
| `inventory_refs` | Pflicht vor DONE bei FEAT/CHG/BUG | verlinkte INV-Eintraege |
| `review_file` | auto | Review-Artefakt, Standard `tasks/reviews/<id>.md` (`--review-file` aendert) |

## Evidence-Matrix (was DONE braucht)

| Typ | Rot (Exit!=0) | Gruen (Exit 0) | Lint (Exit 0) | Reviewer + Artefakt | Inventar |
|---|---|---|---|---|---|
| FEAT | ja | ja | falls `lint_command` | ja + `tasks/reviews/<id>.md` | ja |
| BUG | ja | ja | falls `lint_command` | ja + `tasks/reviews/<id>.md` | ja (Anker am INV-Eintrag) |
| CHG | falls `--tdd` | ja | falls `lint_command` | ja + `tasks/reviews/<id>.md` | ja |
| TECH | nur falls `--tdd` | ja | falls `lint_command` | ja + `tasks/reviews/<id>.md` | optional |

Alle Evidence-Dateien entstehen ueber
`node scripts/record-check.mjs <TASK-ID> -- <befehl>` unter `tasks/evidence/`;
der Befehl in der Evidence muss zum deklarierten `test_command`/`lint_command`
passen (wird geprueft).

## Lebenszyklus

```
add-task (TODO)
 → update-task IN_PROGRESS --by <agent>
 → branch-task <id>            (main-Sync + Branch, Name = Task-ID)
 → [TDD] record-check roter Test (Exit!=0) → Implementierung → record-check gruen (Exit 0)
 → Review auf dem Branch-Diff   (Findings nach tasks/reviews/<id>.md,
                                 --reviewed-by code_reviewer|security_reviewer)
 → push-task <id>               (nur bei Remote; Review-Einreichung)
 → merge-task <id>              (Konfliktprognose + --no-ff Merge auf main)
 → Inventar pflegen + --add-inv (nur FEAT/CHG/BUG)
 → update-task DONE             (mit allen Evidence-Flags)
 → archive-tasks                (bei Meilenstein-Abschluss)
```

BLOCKED erfordert `--reason`; Fix-Retries max. 3 (`record-fix.mjs`), dann
Nutzerentscheidung. Buchhaltungsdateien (`tasks/state.json` u. a.) werden nur
auf main geschrieben — nie auf Task-Branches.

## Beispiel: kompletter FEAT-Task

```powershell
node scripts/add-task.mjs FEAT-3 --component web --title "Nutzerliste sortierbar" `
  --ak "Liste sortiert nach Klick auf Spaltenkopf; auf/ab schaltbar" `
  --test "npm --prefix apps/web test -- users" --lint "npm --prefix apps/web run lint" `
  --deps "TECH-1"

node scripts/update-task.mjs FEAT-3 IN_PROGRESS --by web_developer
node scripts/branch-task.mjs FEAT-3
# test_engineer: failing Test schreiben
node scripts/record-check.mjs FEAT-3 -- npm --prefix apps/web test -- users   # schlaegt fehl (rot)
# web_developer: implementieren
node scripts/record-check.mjs FEAT-3 -- npm --prefix apps/web test -- users   # gruen
node scripts/record-check.mjs FEAT-3 -- npm --prefix apps/web run lint        # gruen
node scripts/push-task.mjs FEAT-3      # nur bei Remote
node scripts/merge-task.mjs FEAT-3
node scripts/update-inventory.mjs INV-3 --capability "Nutzerliste sortierbar" `
  --component web --introduced-by FEAT-3 --anchor "test:apps/web/test/users.spec.js"
node scripts/update-task.mjs FEAT-3 --add-inv INV-3
node scripts/update-task.mjs FEAT-3 DONE --test-evidence tasks/evidence/FEAT-3-<gruen>.json `
  --red-evidence tasks/evidence/FEAT-3-<rot>.json --lint-evidence tasks/evidence/FEAT-3-<lint>.json `
  --reviewed-by code_reviewer --review-result "OK: sortiert, Tests gruen, lint sauber"
```

## Beispiel: Prototyp-Task (Layout vor Implementierung)

```powershell
node scripts/add-task.mjs TECH-7 --component web --title "Prototyp Nutzerliste" `
  --test "node --check docs/prototypes/user-list.html" --scope docs/prototypes/
# Ergebnis: self-contained HTML-Prototyp; Nutzer prueft im Browser,
# danach folgt der eigentliche FEAT-Task mit Referenz auf die Datei.
```

## Beispiel: CHG ohne Verhaltensaenderung vs. mit

```powershell
# reines Refactoring — keine rote Evidence noetig:
node scripts/add-task.mjs CHG-4 --component web --title "Helper extrahieren" --test "npm test"
# Verhaltensaenderung — TDD wie FEAT:
node scripts/add-task.mjs CHG-5 --component web --title "Sortierung absteigend" --test "npm test" --tdd
```
