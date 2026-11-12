# Review CHG-23 — App-Name: Prinzgame → Raccoons-Quiz

**Reviewer:** code_reviewer
**Implementiert von:** web_developer
**Branch:** CHG-23 (Fast Path CHANGE, Nutzerwunsch „an allen Stellen")

## Scope

- `apps/web/index.html` — `<title>Raccoons-Quiz</title>`
- `apps/web/src/routes/Pages.tsx` — h1 der `/`-Route `Raccoons-Quiz`
- `apps/web/src/app-routes.test.tsx` — Erwartung angepasst
- `Prinzgame.md` → `Raccoons-Quiz.md` (`git mv`), alle Referenzen
  in `docs/` + `tasks/reviews/FEAT-8.md` auf den neuen Dateinamen

## Findings

- **AK erfuellt**: Volltextsuche zeigt kein `Prinzgame` mehr ausserhalb
  der Task-Buchhaltung (AK-Text/Titel beschreiben die Umbenennung —
  korrekt so); `tmp/worktrees/` ist Altbestand ausserhalb des Repos-
  Scopes und wurde nicht angefasst.
- Rename der Spec-Datei ist woertliche Umsetzung von „an allen
  Stellen"; Verweise in Docs bleiben so aufloesbar.
- Kein Code-Logik-Impact; Test deckt die sichtbare h1 ab; Title nur
  statisches Markup.
- Stackkonform, keine Dependency-/Framework-Aenderung.

## Evidence

- Rot: `CHG-23-2026-11-12T10-46-55-340Z.json` (exit 1)
- Gruen: `CHG-23-2026-11-12T10-48-17-183Z.json` (exit 0)
- Lint: `CHG-23-2026-11-12T10-48-31-150Z.json` (exit 0)

## Fazit

Freigabe ohne Blocker.
