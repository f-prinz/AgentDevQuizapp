# BUG-2 code review

**Result: APPROVED.**

Reviewed the branch diff: `apps/web/src/GameViews.tsx`, `lobby-views.test.tsx`.

## Root Cause

`react-qr-code@2.0.18` ist reines CJS (`lib/index.js`: `exports.QRCode` + `exports.default`, ohne `exports`-Feld). Der bisherige `import QRCode from "react-qr-code"` liefert je nach Interop-Pfad unterschiedliche Strukturen: Vitest/Node loesen ueber `__esModule` auf, Vite-Dev (esbuild-Prebundle) liefert ein verschachteltes Namespace-Objekt — `<QRCode/>` bekam dann ein Objekt statt einer Komponente → „Element type is invalid ... but got: object" in `ProjectorGameView` (nur Projektorroute, Lobbyphase).

## Fix

`resolveComponent()` packt `.default`-Ketten rekursiv aus und waehlt aus einem terminalen Namespace-Objekt den Funktionswert (QRCode-Key). Bindung via `import * as QRCodeModule` + `resolveComponent` — deckt alle drei beobachteten Formen ab: Funktion direkt, `{default: …}`-Kette, `{QRCode}`-Terminalobjekt.

## Regression test

`BUG-2 QR component interop` in `lobby-views.test.tsx`: Stub-Funktion in allen vier Shapes (direkt, einfach/doppelt geschachtelt, QRCode-Key) plus Assertions auf den tatsaechlichen Paket-Namespace (`pkg`, `pkg.default`, `pkg.QRCode` — allesamt auf Funktion aufloesbar). Test schlug rot, weil der Helper fehlte; deckt die Interop-Falle ab, ohne vom Vite-Dev-Prebundle-Verhalten abzuhaengen.

## Findings

- Keine Dependency-/Stack-Aenderung; Fix komplett in `apps/web`.
- Kein Secret-/Auth-/Input-Bezug → kein security_reviewer noetig.
- Dev-Verifikation des QR-Renders bleibt dem Nutzer ueberlassen (Projektor-Link neu laden).

## Evidence

- Rot: `tasks/evidence/BUG-2-2026-10-27T12-56-50-420Z.json` (exit 1, fehlender `resolveComponent`-Export)
- Gruen: `tasks/evidence/BUG-2-2026-10-27T13-01-50-533Z.json` (63/63, exit 0)
- Lint/Typecheck: `tasks/evidence/BUG-2-2026-10-27T13-02-01-875Z.json` (exit 0)
