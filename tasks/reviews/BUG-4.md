# Review BUG-4 — Host-Lobby: Copy-Icon nicht sichtbar, Link ohne Domain

Reviewer: code_reviewer (nicht implemented_by web_developer)
Diff-Basis: Branch BUG-4 gegen main.

## Akzeptanzkriterien

- [x] Angezeigte Beitritts-/Projektorlinks enthalten die Domain: `CopyLinkButton` zeigt `{url}` (`new URL(link, window.location.origin).href`) statt `{link}`; Projektor-Lobby zeigt `joinUrl` statt `snapshot.playerLink`.
- [x] Copy-Icon zuverlaessig sichtbar: CSS-Konflikt behoben — `.game-view button` (gleiche Spezifitaet, spaeter im Stylesheet) ueberschrieb `padding`/`min-height` von `.link-copy button` und quetschte das Icon; Regel jetzt als `.lobby-links .link-copy button` (0-2-1) plus `flex-shrink: 0` auf Button und SVG. Icon durch bewaehrtes Stroke-SVG (Lucide-Form, `fill="none" stroke="currentColor"`) ersetzt.

## Prüfpunkte

- **Stack**: keine neuen Dependencies, keine Framework-Aenderung (`CURRENT_STACK_ONLY`).
- **Root Cause Icon**: DOM-Render war korrekt (Button mit Accessible Name im Tree), aber `.game-view button` (Zeile 43, gleiche Spezifitaet, spaeter) setzte `padding: 0.65rem 0.85rem` + `min-height: 2.75rem` ueber `.link-copy button` (Zeile 29) — 2,25-rem-Button mit ~21 px Padding ließ dem 18-px-SVG keine verwertbare Flaeche. Fix per Spezifitaets-Erhoehung statt `!important`.
- **Root Cause Domain**: Anzeige nutzte den rohen relativen Server-Pfad; nur der kopierte Wert wurde absolutiert. Anzeige und Copy-Wert jetzt identisch (`url`).
- **Tests**: Copy-Test um Assertions fuer absolute Anzeige erweitert (rot -> gruen); Projektor-Link-Test auf absolute Erwartung umgestellt; Clipboard-Flow unveraendert (relative Server-Links bleiben Contract, Client absolutiert).
- **QR-Code** kodierte bereits die absolute URL — Verhalten bestaetigt, keine Aenderung noetig.

## Befunde

- Keine Blocker.
- Falls das Icon im produktiven Stand zusaetzlich durch Browser-Cache (altes CSS-Bundle) unsichtbar blieb, loest sich das mit dem naechsten Deploy (Hash-Filenames).

## Evidence

- Rot (TDD): `tasks/evidence/BUG-4-2026-10-28T15-39-39-548Z.json` (exit 1 — Anzeige relativ statt absolut)
- Zwischenlauf: `tasks/evidence/BUG-4-2026-10-28T15-40-19-433Z.json` (exit 1 — Projektor-Test noch auf relativen Text erwartet; Erwartung angepasst)
- Gruen: `tasks/evidence/BUG-4-2026-10-28T15-41-04-240Z.json` (exit 0, 75/75)
- Lint: `tasks/evidence/BUG-4-2026-10-28T15-40-30-794Z.json` (exit 0)

## Ergebnis

APPROVED — beide Akzeptanzkriterien erfuellt, keine Blocker.
