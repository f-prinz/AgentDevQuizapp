# Agent-Kontext

Betriebliche Fakten und Invarianten fuer alle Subagents. Stack-Entscheidungen und
freigegebene Zielarchitektur stehen verbindlich in `docs/tech-stack.md`.

## Projektstruktur

- `tasks/` `state.json` — Task-State (Single Source of Truth; Schreiben nur via
  `scripts/update-task.mjs` durch den Orchestrator); `backlog.md` — generierte
  Ansicht (nicht von Hand editieren); `inventory.json` — Funktionsinventar
  (Pflege via `scripts/update-inventory.mjs`); `archive.json` — abgeschlossene
  Tasks; `evidence/` — ausgefuehrte Pruefungen mit Exit-Code
- `docs/` Anforderungen, Architektur, Berichte, Playbooks, Templates;
  `changes.md`/`changes-archive.md` Eingangskorb bzw. Archiv fuer Wuensche;
  `feature-inventory.md` generierte Inventar-Ansicht (nicht von Hand editieren);
  `templates/request-*.md` Anfrage-Vorlagen (Vollformat je Task-Typ)
- `scripts/` Hilfs- und Pruef-Skripte (nur Node-Varianten; .ps1 wurde entfernt)
- `apps/<komponente>/` je Anwendungskomponente (Konvention)
- `contracts/` Schnittstellen-Artefakte zwischen Komponenten; aenderbar nur
  ueber CONTRACT_CHANGE-Tasks (Praefix `TECH-`)
- `docs/prototypes/` Layout-Prototypen (self-contained HTML + PNG) —
  Referenz fuer Features; Erstellung als TECH-Task mit
  `--scope docs/prototypes/`

## Komponenten

| Komponente | Verzeichnis | Build | Test | Lint | Run | Dev-Agent | Test-Agent |
|---|---|---|---|---|---|---|---|
| <!-- <name> | apps/<name>/ | <build> | <test> | <lint> | <run> | <name>_developer | <name>_test_engineer --> |
| web | apps/web/ | `npm --prefix apps/web run build` | `npm --prefix apps/web test` | `npm --prefix apps/web run lint` | `npm --prefix apps/web run dev` | web_developer | web_test_engineer |
| server | apps/server/ | `npm --prefix apps/server run build` | `npm --prefix apps/server test` | `npm --prefix apps/server run lint` | `npm --prefix apps/server run dev` | server_developer | server_test_engineer |

Deklariert sind Komponenten in `docs/tech-stack.md`, `tasks/state.json` und
`.codex/config.toml`; alle drei Stellen muessen uebereinstimmen (Pruefung:
`node scripts/verify.mjs`). Neue Komponenten werden ausschliesslich ueber
`node scripts/add-component.mjs <name> --purpose "<text>"` angelegt.

## Befehle

- `node scripts/check-state.mjs` — Task-State: Transitionen, Abhaengigkeiten,
  Evidence (gruen + rot + lint), Reviewer, Backlog-Synchronisation
- `node scripts/check-inventory.mjs` — Inventar-Konsistenz + Anker-Existenz
- `node scripts/verify.mjs` — Agent-Registrierung + Komponenten-Konsistenz
- `node scripts/add-task.mjs <TECH|BUG|CHG|FEAT-n> --component <c> --title "<t>"
  [--ak s] [--test s] [--lint s] [--deps "A,B"] [--scope p]* [--tdd|--no-tdd]`
  — Tasks anlegen. `--tdd` erzwingt rote Evidence (Standard: FEAT/BUG an,
  CHG/TECH aus); `--lint` setzt den Lint-Befehl des Tasks (aus tech-stack.md)
- `node scripts/update-task.mjs <id> [STATUS] [--by <agent>] [--reason <text>]
  [--test-evidence <file>] [--red-evidence <file>] [--lint-evidence <file>]
  [--reviewed-by <agent>] [--review-file <path>] [--test-result <text>]
  [--review-result <text>] [--add-inv INV-x] [--scope <path>]* [--deps-change]`
  — Statuswechsel; erzwingt Transitionen
  (TODO→IN_PROGRESS→DONE/BLOCKED; BLOCKED→IN_PROGRESS/TODO; DONE ist terminal),
  rendert backlog.md und progress.md automatisch. `state.json` wird ausschliesslich
  ueber diese beiden Skripte geschrieben. DONE erfordert zusaetzlich ein
  Review-Artefakt `tasks/reviews/<id>.md` (oder `--review-file <path>`).
  `--deps-change` erlaubt Dependency-Manifest-Aenderungen auf dem Task-Branch.
- `node scripts/sync-main.mjs` — main auf Remote-Stand (ff-only, nur bei
  Remote); `node scripts/branch-task.mjs <id>` — Task-Branch anlegen (Sync
  inklusive); `node scripts/merge-task.mjs <id>` — Konfliktprognose + --no-ff
  Merge auf main (loescht den Branch danach, `--keep` behaelt ihn);
  `node scripts/push-task.mjs <id>` — Task-Branch pushen
  (nur bei Remote, verweigert bei Konfliktprognose)
- `node scripts/selftest.mjs` (`npm test`) — End-to-End-Test der Skripte in
  einem Temp-Repo (positiver Lebenszyklus + alle Negativ-Gates)
- `node scripts/record-check.mjs <TASK-ID> -- <befehl>` — fuehrt Pruefbefehl
  aus und speichert Exit-Code + Output unter `tasks/evidence/` (Pflicht-Nachweis
  fuer DONE; DONE ohne Evidence-Datei mit exit_code 0 ist unmoeglich)
- `node scripts/update-inventory.mjs INV-xxx --capability ... --component ...`
  — schreibt NUR `inventory.json`; Anker via `--anchor type:ref`, Typen
  `test`, `route`, `file`, `ui_step`; Route-Anker brauchen die deklarierende
  Datei: `--anchor "route:<file>::<METHOD PATH>"`. Verlinkung zum Task via
  `update-task <id> --add-inv INV-x`
- `node scripts/check-scope.mjs <TASK-ID>` — uncommitted Aenderungen gegen den
  Task-Scope; `node scripts/check-commit-scope.mjs` — staged Dateien
- `node scripts/record-fix.mjs <TASK-ID> "<Diagnose>"` — Fix-Retry zaehlen (max 3)
- `node scripts/archive-tasks.mjs [TASK-IDs]` — DONE-Tasks nach
  `tasks/archive.json` verschieben (bei Meilenstein-Abschluss)
- `node scripts/add-component.mjs` / `node scripts/install-hooks.mjs` — siehe oben
- Build-, Test- und Startbefehle je Komponente stehen in der Tabelle oben und
  werden nach Stack-Freigabe dokumentiert.

## Task-Scope, Branches und Evidence

- Der Scope eines Tasks wird aus der Komponente abgeleitet (`apps/<komp>/` bzw.
  `contracts/`); Buchhaltungspfade (`tasks/`, `docs/progress.md`,
  `docs/feature-inventory.md`) sind immer erlaubt — aber nur auf main.
  Abweichungen via `--scope <path>` beim Task anlegen (z. B. Root-Dateien bei
  Scaffolding).
- **Branch-Workflow:** jeder Task bekommt einen eigenen Branch, Name = Task-ID
  (`branch-task.mjs`). Auf Task-Branches sind nur Code-Dateien im Task-Scope
  plus `tasks/evidence/` und `tasks/reviews/` erlaubt; diese Dateien sind dort
  VERBOTEN (gehoeren auf main): `tasks/state.json`, `tasks/backlog.md`,
  `tasks/inventory.json`, `tasks/archive.json`, `docs/progress.md`,
  `docs/feature-inventory.md`.
  Der pre-commit Hook (`check-commit-scope.mjs`) setzt das durch; Merge-Commits
  sind ausgenommen. Der Hook blockiert zusaetzlich moegliche Secrets im Diff
  und Dependency-Manifest-Aenderungen (package.json, Lockfiles, pom.xml,
  requirements.txt u. a.) auf Task-Branches ohne `allows_dep_change`
  (`--deps-change` beim Task oder via update-task).
- `merge-task.mjs` prueft Merge-Konflikte, bevor sie entstehen — Konflikte
  werden auf dem Task-Branch geloest (`git merge main` dort), nie auf main.
- `update-task DONE` prueft den Task-Diff mechanisch gegen den Scope; der
  Abschluss erfolgt auf main NACH dem Merge.
- `red_evidence` (failing Test, Exit != 0) und `lint_evidence` (Exit 0)
  sind Evidence-Dateien wie `test_evidence` — Pflicht je nach Task-Flags.
- `reviewed_by` muss `code_reviewer` oder `security_reviewer` sein und von
  `implemented_by` abweichen — mechanisch erzwungen.

## Funktionsinventar und Aenderungskorb

- `tasks/inventory.json` dokumentiert jede nutzerpruefbare Faehigkeit
  (Status `active`/`removed`; entfernte Faehigkeiten bleiben mit `removed_by`
  erhalten). FEAT-/CHG-/BUG-Tasks muessen mindestens einen INV-Eintrag in
  `inventory_refs` referenzieren, bevor sie DONE werden.
- `docs/changes.md` sammelt aufgeschobene Wuensche (`[CHG]`/`[FEAT]`/`[BUG]`).
  Sobald mehr als 20 erledigte Eintraege im Abschnitt "Umgesetzt" stehen,
  archiviert der Orchestrator sie nach `docs/changes-archive.md`. Schreiben:
  Orchestrator/documentation_agent; Lesen bei Bedarf: analyst, scope_auditor.
- `scope_auditor` prueft das Inventar gegen den Ist-Zustand — verpflichtend vor
  Meilensteinen/final-report, sonst auf Zuruf (`docs/playbooks/audit.md`).

## UI-/Browser-Pruefung

Bei UI-relevanten Aenderungen: Komponente lokal starten (Run-Befehl aus der
Tabelle oben), den betroffenen Nutzerablauf im Browser nachspielen und das
Ergebnis als `ui_step`-Anker im Inventar dokumentieren. Pruefungen, die als
Befehl ausfuehrbar sind (z. B. E2E-Testlaeufe), laufen ueber
`record-check.mjs`, damit sie als Evidence zaehlen. Konkretes Tooling
(Browser-Treiber, Ports) wird nach Stack-Freigabe hier ergaenzt.

## Umgebungsgrenzen

- Keine Netzwerkzugriffe, Installationen oder Dependency-Aenderungen ohne Freigabe.
- Kein Deployment, keine produktiven Daten oder Dienste.
- Push nur durch den Orchestrator, nur Task-Branches, nur bei Remote (`push-task.mjs`); main wird nie gepusht. `git fetch`/`git pull --ff-only` auf main ist erlaubt.

## Sicherheits- und Vertragsinvarianten

Global:
- Nutzereingaben nur als Text rendern, kein `innerHTML` mit Nutzerdaten.
- Keine Secrets speichern oder ausgeben; `.env` ignorieren, `.env.example` verwenden.
- Kein Code liest oder schreibt ausserhalb des eigenen Komponenten-Verzeichnisses;
  Kopplung ausschliesslich ueber `contracts/`. Mechanisch geprueft ueber
  den Task-Scope (`check-scope.mjs`, pre-commit `check-commit-scope.mjs`).

Pro Komponente:
- server: Lobbysitzungen/Spielstaende nur in-memory (keine Persistenz ueber
  Neustart, Entscheidung O6); persistent sind ausschliesslich
  Spielinhalte/Katalog (Seed). Timer-Endzeitpunkte werden serverseitig
  authoritative gefuehrt; Clients rechnen nur mit uebermittelter Deadline.
  Antwortannahme bis `deadline + 2000ms` (Latenzausgleich).
- web: Farben nur als CSS Custom Properties aus dem zentralen Theme-File
  (`--color-turquoise: #48A3AE`, `--color-red: #FE0000`,
  `--color-grey: #706A6A`, `--color-bg: #1D1D1B`); Rohwerte (Hex/RGB)
  ausserhalb des Themes sind Review-Findings. Mobile First fuer
  Spieler-/Host-Ansichten; Projektor-Route ist Desktop-Layout.
