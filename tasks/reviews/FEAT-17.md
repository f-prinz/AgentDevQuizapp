# Review: FEAT-17 — Light/Dark-Theme-Toggle

**Reviewer:** code_reviewer
**Implementiert von:** web_test_engineer / web_developer
**Branch:** FEAT-17
**Feature-Doc:** `docs/feature-theme-toggle.md` (Fast Path)

## Geprüfte Umsetzung

- `apps/web/src/ThemeToggle.tsx` (neu): Sonne/Mond-Button (lucide-react,
  bereits freigegeben via CHG-13). Initial: localStorage `theme` ->
  `prefers-color-scheme` -> Dark-Fallback. Klick setzt
  `data-theme` auf `documentElement` und persistiert. aria-label beschreibt
  die Aktion; Icon zeigt den Zielzustand.
- `apps/web/src/routes/AppShell.tsx`: Toggle in der Shell -> auf allen
  Routen sichtbar (Start, Join, Player, Host, Projektor, Admin).
- `apps/web/src/styles/theme.css`: `:root[data-theme="light"]` ueberschreibt
  die sechs CSS-Variablen (helle Slate-Basis, Indigo/Danger fuer Kontrast
  dunkler); `color-scheme` je Theme fuer Native-Controls/Scrollbar.
- `apps/web/src/styles/app.css`: `.theme-toggle` fixed top-right, z-index 50,
  fokussierbar mit Outline.

## Testfälle

- `app-routes.test.tsx` (describe „FEAT-17 theme toggle"): Button auf drei
  repraesentativen Routen, Default Dark, Toggle+localStorage-Persistenz in
  beide Richtungen, Wiederherstellung persistierter Wahl,
  prefers-color-scheme-Initial ohne Persistenz.

## Verifikation

- Rot: `tasks/evidence/FEAT-17-2026-10-29T10-30-53-021Z.json` (exit 1)
- Grün: `tasks/evidence/FEAT-17-2026-10-29T10-31-51-893Z.json` — 86/86 (exit 0)
- Lint+Typecheck: `tasks/evidence/FEAT-17-2026-10-29T10-32-15-438Z.json` (exit 0)

## Befund

- Scope: `apps/web/` — passt zu `allowed_paths`; keine Contract-/Dep-Aenderung.
- Alle Farben gehen durch CSS-Variablen — der Toggle wirkt app-weit ohne
  Inline-Farben. Keine Blocker.
