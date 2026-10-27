# CHG-5 code review

**Result: APPROVED.**

Reviewed the branch diff: `Pages.tsx`, `GameViews.tsx`, `app.css`,
`app-routes.test.tsx`, `game-views.test.tsx`, `package.json`, `package-lock.json`.

## Akzeptanzkriterien

- **Projektor ohne h1, volle Seite:** `<h1>Projektor</h1>` entfernt,
  `aria-label` statt `aria-labelledby`; `.projector` nutzt `width: 100%` und
  `min-height: 100vh`, Layout-Grid füllt die verbleibende Höhe.
- **Sortier-Titel verborgen:** `PlayerGameView` (h2) und `ProjectorGameView`
  (h3) rendern `round.game.title` nicht, wenn `kind === "sorting"`.
- **dnd-kit für Sortieren:** `DndContext` + `SortableContext` +
  `useSortable` in neuer `SortableTerm`-Komponente; PointerSensor
  (Aktivierungsdistanz 5px, blockiert keine Button-Klicks) und
  KeyboardSensor mit `sortableKeyboardCoordinates`. HTML5-Drag-Handler und
  `dragIndex`-State entfernt. ↑/↓-Buttons bleiben als zugängliche
  Alternative erhalten.

## Findings

- Neue Deps `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` —
  React-Ökosystem der Web-Komponente, vom Nutzer ausdrücklich gewünscht
  ("bessere Library, zb dnd"). Kein Contract-/Stack-Bezug.
- dnd-kit setzt `role="button"` auf sortable `li`s — Tests auf
  `.sortable-terms li`-Selektor umgestellt (listitem-Rolle geht verloren,
  entspricht dem dnd-kit-Standard).
- Inventar: INV-14 (phasenabhängige Views) betroffen; Notiz angepasst.

## Evidence

- Rot: `tasks/evidence/CHG-5-2026-10-27T14-24-22-344Z.json` (exit 1)
- Rot-Iteration: `tasks/evidence/CHG-5-2026-10-27T14-24-55-204Z.json`
- Gruen: `tasks/evidence/CHG-5-2026-10-27T14-25-33-635Z.json` (65/65, exit 0)
- Lint/Typecheck: `tasks/evidence/CHG-5-2026-10-27T14-25-03-405Z.json` (exit 0)
