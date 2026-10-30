# Review CHG-20 — Lobbymenue als Host-Accordion

**Reviewer:** code_reviewer
**Implementiert von:** web_developer
**Branch:** CHG-20

## Scope

- `apps/web/src/GameViews.tsx` — neue `LobbyAccordion`-Komponente
  (kontrolliertes `<details>`, default offen, Inhalt = bisheriges
  Lobbymenue + Lobby-ID); Inline-Lobby-Section aus `HostGameView`
  entfernt (kein Duplikat)
- `apps/web/src/routes/Pages.tsx` — `Lobby: <id>`-Zeile durch
  `LobbyAccordion` ersetzt (nur bei Host-Snapshot)
- `apps/web/src/styles/app.css` — summary/h2-Accordion-Styling
- Tests: neuer `host lobby accordion`-Block (3 Tests); zwei
  Bestands-Queries praezisiert (`/spielphase starten/i`, `/^starten$/i`)

## Findings

- **Kein Duplikat**: das Inline-Menue in der Lobbyphase ist entfernt,
  `HostGameView` liefert ohne Runde nur noch `HostOverview` oder null —
  das Accordion traegt den Menue-Inhalt auf allen Phasen.
- **State-Handling**: `open` kontrolliert via `onToggle` —
  default-offen, klickbar schliessbar, kein Persist (Default AK).
- **Buttons**: `Lobby starten` bleibt ueber `canStartLobby` serverseitig
  gegated — ausserhalb der Lobbyphase disabled, wie vereinbart.
- **A11y**: natives `<details>/<summary>` ist tastatur- und
  screenreader-tauglich; h2 im summary behaelt die Heading-Struktur.
- **Testanpassungen berechtigt**: `/start/i` und `/starten/i` wurden
  durch den neuen `Lobby starten`-Button mehrdeutig — Praezisierungen
  dokumentiert und fachlich korrekt.
- Kein Contract-/Dependency-Impact; `links`-Felder waren bereits im
  Host-Snapshot vorhanden.

## Evidence

- Rot: `CHG-20-2026-10-30T11-20-07-943Z.json` (exit 1)
- Zwischenlauf: `CHG-20-2026-10-30T11-21-45-682Z.json`,
  `CHG-20-2026-10-30T11-23-35-547Z.json` (Query-Mehrdeutigkeiten,
  gefixt)
- Gruen: `CHG-20-2026-10-30T11-25-25-080Z.json` (exit 0, 103/103)
- Lint: `CHG-20-…` (exit 0)

## Fazit

Freigabe ohne Blocker.
