# Benutzung Schritt fuer Schritt

Der komplette Weg von Template zu laufender Entwicklung — aus deiner
Perspektive als Nutzer. Details zu Tasks stehen in `docs/task-templates.md`,
die Kommando-Kurzreferenz in `docs/orchestrator-checklist.md`.

## 1. Einmalig einrichten

```powershell
git init -b main            # Pflicht: der gesamte Branch-/Scope-Workflow setzt git voraus
git add -A; git commit -m "init"
node scripts/install-hooks.mjs   # pre-commit Hook (Scope, Secrets, Konsistenz)
npm test                         # Sanity-Check: alle Gates funktionieren
```

Dann die Pflichtangaben:

1. **`docs/project-idea.md`** ausfuellen — Rollen, Ablaeufe, Datenstrukturen.
   Je konkreter, desto weniger Rueckfragen stellt der Analyst spaeter.
2. **Pro Komponente:** `node scripts/add-component.mjs <name> --purpose "<zweck>"`.
   Legt `apps/<name>/`, das Agenten-Paar und alle Registrierungen an.
3. **`docs/tech-stack.md`**: pro Komponente die Stack-Tabelle ausfuellen und
   `Status: FREIGEGEBEN` setzen. Optional `Lint/Statik-Analyse` eintragen —
   gefuellt wird Lint zum harten Gate, leer entfaellt der Schritt.
4. **`docs/agent-context.md`**: Build-/Test-/Run-Befehle und Invarianten je
   Komponente (fuer UI z. B. die CSS-Variablen-Regel; das Beispiel steht drin).

Kontrolle: `node scripts/verify.mjs` muss gruen sein.

## 2. Erststart

Codex-Sitzung im Projektordner oeffnen, Inhalt von **`docs/start-prompt.md`**
als ersten Auftrag einreichen. Was dann passiert:

1. **Klaerungsphase:** der Analyst stellt dir eine geordnete Rueckfragenliste
   (je Frage: Relevanz, Optionen, Default-Vorschlag) — du beantwortest sie,
   bevor irgendetwas geplant wird.
2. **Stack-Entscheidungen:** der Software Architect bewertet den Stack; bei
   Abweichungen haelt er inne (`BLOCKED - USER DECISION REQUIRED`) — du
   entscheidest.
3. **Backlog:** der Planner legt die Task-Liste in `tasks/state.json` an;
   `tasks/backlog.md` zeigt sie dir lesbar.
4. **Umsetzung:** je Task ein Branch, roter Test zuerst (TDD), dann Code,
   Review, Merge auf main — alles automatisiert, mit Evidence-Dateien in
   `tasks/evidence/`.

## 3. Laufender Betrieb

Neue Wuensche formulierst du ganz normal ("Bug: Login wirft 500 bei …",
"Feature: Als Admin moechte ich …"). Der Orchestrator klassifiziert und spielt
das passende Playbook. `docs/automation-prompt.md` fuer Iterations-Runden,
`docs/resume-prompt.md` nach Sitzungsabbruch. Schneller und rueckfragenarm geht
es mit den fertigen Anfrage-Vorlagen unter `docs/templates/request-*.md` —
ausfuellen und einreichen (oder als Eintrag in `docs/changes.md`).

**Du wirst nur bei echten Entscheidungen unterbrochen:**

| Unterbrechung | Deine Optionen |
|---|---|
| Rueckfragen (Klaerungsphase) | beantworten; Default-Vorschlaege stehen dabei |
| `BLOCKED - USER DECISION REQUIRED` (Stack) | Abweichung freigeben oder ablehnen |
| Selbes Finding 3x fehlgeschlagen | Finding akzeptieren / Regel ausnehmen / selbst fixen |
| Merge-Konflikt unloesbar | selbst loesen oder Task neu schneiden |
| Divergierter main (Sync ff-only) | lokale main-Commits selbst bereinigen |

Alles andere laeuft durch: Scope-Verletzungen, fehlende Tests, fehlende
Evidence, Reviewer-Unabhaengigkeit, falscher Branch — blockiert das System
mechanisch selbst.

### Layout-Eingaben (bei Web/App-Frontends)

- **Grobe Richtung** → im Text beschreiben ("Dashboard, Sidebar links, dunkel").
  Reicht, wenn dir das Layout egal ist — der Stack entscheidet den Rest.
- **Konkretes Layout** → HTML-Prototyp oder Skizze nach `docs/prototypes/`
  legen (siehe `docs/prototypes/README.md`) und in der Anfrage referenzieren:
  *"Feature: Nutzerliste, Layout wie docs/prototypes/user-list.html."*
- **Kein HTML koennen/moegen?** → dem Orchestrator sagen *"baue zuerst einen
  HTML-Prototyp unter docs/prototypes/ fuer …"* — das laeuft als normaler
  TECH-Task; du pruefst das Ergebnis im Browser, bevor implementiert wird.

## 4. Beobachten

- `tasks/backlog.md` — lesbare Task-Uebersicht (generiert)
- `docs/feature-inventory.md` — was die Anwendung kann (generiert)
- `tasks/reviews/<TASK-ID>.md` — Review-Findings je Task
- `docs/progress.md` — laufendes Protokoll
- `tasks/state.json` — Maschinenzustand (nie von Hand editieren)

## 5. Meilenstein

1. Inventar-Audit (scope_auditor, `docs/playbooks/audit.md`) — deckt
   Luecken zwischen gebautem und dokumentiertem Funktionsumfang auf.
2. `node scripts/archive-tasks.mjs` — erledigte Tasks nach
   `tasks/archive.json`.
3. `docs/final-report.md` — Tests, Ergebnisse, bekannte Probleme,
   Startbefehle.

## 6. Regeln im Ueberblick

- Kein Deployment; Push nur Task-Branches bei Remote, main nie.
- Jeder Task = eigener Branch (Name = Task-ID), gemergt nach Review.
- Buchhaltungsdateien nur auf main.
- Tests: rot→gruen bei FEAT/BUG (TDD); CHG/TECH optional per Flag.
- Max. 3 Fix-Versuche, dann Entscheidung — keine Endlosschleifen.

## Referenz

| Was | Wo |
|---|---|
| Task-Felder, Evidence-Matrix, CLI-Beispiele | `docs/task-templates.md` |
| Anfrage-Vorlagen zum Ausfuellen | `docs/templates/request-*.md` |
| Befehlssequenz + alle Gates | `docs/orchestrator-checklist.md` |
| Komponenten, Invarianten, Befehle | `docs/agent-context.md` |
| Stack-Governance | `docs/tech-stack.md` |
| Anfrage-Typen | `docs/playbooks/*.md` |
| Orchestrator-Regeln | `AGENTS.md` |
