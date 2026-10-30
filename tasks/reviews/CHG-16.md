# Review CHG-16 — Einheitliche Section-Headings, Light-Mode-Kartenkontrast, Identity-Icons

**Reviewer:** code_reviewer
**Implementiert von:** web_developer
**Branch:** CHG-16

## Scope

- `apps/web/src/styles/theme.css` — neuer Token `--color-on-grey` (dark: `#FFFFFF`,
  light: `#0F172A`)
- `apps/web/src/styles/app.css` — neutrale Antwortkarten (`.answer-option`,
  `.answer-tile`, `.answer-mark`, sortierbare Buttons) nutzen den Token statt
  hart `#fff`; geteilte Heading-Regel `.projector-ranking h2, .results h2`
- `apps/web/src/GameViews.tsx` — `Results` h3→h2; `player-identity` zeigt
  `Name - <Podium> Rang <Star> Punkte` statt `Punkte (Rang)`
- `apps/web/src/game-views.test.tsx`, `lobby-views.test.tsx`,
  `projector-layout.test.tsx` — neue/angepasste Tests

## Findings

- **Kontrastloesung**: Dunkler Text auf hellgrauen Karten im Light-Theme statt
  Kartenverdunkelung — minimaler Eingriff, farbige Zustaende (correct/wrong/
  selected) unveraendert und kontraststark.
- **Headings**: h3→h2 in `Results` + gemeinsame CSS-Regel statt zwei
  divergierender Regeln — semantisch korrekt (Sections gleicher Ebene).
- **Identity**: Icons aria-hidden wie in den Tabellen-Koepfen; zugaenglicher
  Name bleibt lesbar („Ada - 2 9"); Rang vor Punkten wie gewuenscht.
- **Keine Dependency-/Framework-Aenderungen**, lucide-react bereits im Stack.
- Zwischenzeitliche Datei-Verstuemmelung in `app.css` wurde lokalisiert und
  vollstaendig repariert (Fieldset/Wrong/Selectable/Eval-Selektoren verifiziert).

## Evidence

- Rot: `CHG-16-2026-10-30T08-13-41-840Z.json` (exit 1 — neue Tests rot)
- Gruen: `CHG-16-2026-10-30T08-14-14-526Z.json` (exit 0, 92/92)
- Lint: `CHG-16-2026-10-30T08-14-36-159Z.json` (exit 0, eslint + tsc)

## Fazit

Freigabe ohne Blocker.
