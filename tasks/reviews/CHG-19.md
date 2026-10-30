# Review CHG-19 — Kick-Button icon-only + Status-Icon-Farben

**Reviewer:** code_reviewer
**Implementiert von:** web_developer
**Branch:** CHG-19

## Scope

- `apps/web/src/styles/app.css` — `.page .participant-kick` (Spezifitaet
  erhoeht: schlaegt die globale `.page button`-Regel), `width: auto`,
  `min-height: 0`, `margin: 0`; neue Klassen `.participant-icon-ok` /
  `-bad`
- `apps/web/src/styles/theme.css` — neue Variable `--color-green`
  (Dark `#4ADE80`, Light `#16A34A`)
- `apps/web/src/routes/Pages.tsx` — `participant-icon-ok` an
  MonitorCheck/Check, `-bad` an MonitorX
- `apps/web/src/game-views.test.tsx` — Assertions auf die Farbklassen
  (Loader explizit neutral)

## Root Cause (volle Breite)

Die globale Regel `.page button { width: 100%; min-height: 2.75rem;
margin-top: .65rem }` (Spezifitaet 0,1,1) gewann gegen
`.participant-kick` (0,1,0) — nicht nur `width`, sondern auch
`padding`, `min-height` und `margin` der Kick-Regel wurden ignoriert.
Daher der volle Buttonlook. Fix via `.page .participant-kick` (0,2,0).

## Findings

- **Rechtsbuendig**: `li` ist flex, `.participant-name` hat `flex: 1`,
  Kick ist letztes Item — mit `width: auto` + `flex-shrink: 0` sitzt das
  Icon exakt am rechten Rand.
- **Farben**: MonitorCheck/Check gruen, MonitorX rot — wie gefordert.
  Loader bewusst neutral gemuted (kein Signalzustand).
- **A11y**: Button bleibt echtes `<button>` mit aria-label und
  Focus-Outline (`.page button:focus-visible` greift weiterhin) — nur die
  Optik ist icon-only.
- Theme-konsistent: `--color-green` in beiden Themes mit Light-Variante
  fuer Kontrast; bestehende Palette unangetastet.
- Kein Contract-/Dependency-Impact.

## Evidence

- Test: `CHG-19-2026-10-30T10-34-56-147Z.json` (exit 0, 100/100)
- Lint: `CHG-19-2026-10-30T10-35-20-106Z.json` (exit 0)

## Fazit

Freigabe ohne Blocker.
