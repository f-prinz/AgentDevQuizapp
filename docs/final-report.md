# MVP-Abschlussbericht: Raccoons Quizgame

Datum: 2026-10-27 · Meilenstein: MVP (F1–F6 aus `docs/project-idea.md`)

## Umgesetzter Umfang

- **Lobby und Sitzungen** — Lobby anlegen, Rollenlinks (Host/Spieler/
  Projektor), Namen, Reconnect ohne Duplikate, Spaetbeitritt als
  `waiting` (INV-3/4/5/6/7/9, validiert TECH-7).
- **Übersicht und Rangliste** — Host waehlt ungespielte Spiele,
  Projektor zeigt offene/gespielte Spiele, Rangliste mit Spielspalten
  und animiertem Übergang (INV-17, validiert TECH-11, FEAT-6).
- **Quiz** — Mehrfragenrunde mit Radio-Auswahl, Timer, Wertung
  richtig/falsch/ohne Antwort, Aufloesung (INV-15/16, validiert TECH-8,
  FEAT-4).
- **Sortieren** — Gemischte Begriffe mit geheimen Werten,
  Drag-and-Drop + Button-Fallback, positionsweise Auswertung (INV-18,
  validiert TECH-9, FEAT-10).
- **Schätzen** — Zahleneingabe, Distanz-Wertung, eigene Eingabe und
  Abstand in der Auswertung (INV-19, validiert TECH-10, FEAT-12).
- **Status und Feedback** — Verbindungsstatus, wartende Spieler,
  Antwort-Markierung, vereinfachte Layouts (INV-1/2/10/11/13/14,
  FEAT-14/13/15, BUG-1/2, CHG-1/3).

## Tatsaechlich ausgefuehrte Tests

| Suite | Befehl | Ergebnis |
|---|---|---|
| Server (Unit + e2e) | `npm --prefix apps/server test` | 61/61 Tests, 12 Dateien (~40s, inkl. echter 30s-Deadline) |
| Web | `npm --prefix apps/web test` | 56/56 Tests, 6 Dateien |
| Server Lint/Typecheck | `npm --prefix apps/server run lint` | exit 0 |
| Web Lint/Typecheck | `npm --prefix apps/web run lint` | exit 0 |
| Web Build | `npm --prefix apps/web run build` | exit 0 (letzte Feature-Evidence) |
| Zustandspruefung | `node scripts/check-state.mjs` | exit 0 (Evidence TECH-12) |

e2e-Validierungen (echte REST/WS-Verbindungen bzw. Projektorroute):
`apps/server/test/e2e/lobby.test.ts` (4), `quiz.test.ts` (1, 32s),
`sort.test.ts` (1), `estimate.test.ts` (1), `apps/web/test/e2e/
ranking.test.tsx` (1). Doku je Bereich: `docs/validation/{lobby,quiz,
sort,estimate,ranking}.md`.

## Bekannte Einschraenkungen

- **INV-12-Anker** — der UI-Schritt "Lobby anlegen, Host-Link refreshen"
  ist nicht mechanisch verifizierbar (check-inventory meldet Warnung,
  kein Blocker); der Browserbeleg wurde manuell erbracht.
- **Deadline-Test** — der Quiz-e2e wartet die echte 30s-Deadline
  ab (~33s Laufzeit); bewusst, um den Timeout-Pfad echt zu belegen.
- **Offen am MVP vorbei** — keine Deployments, keine produktiven Daten;
  Katalog liegt statisch auf dem Server; spaeter Beitritt bleibt bis
  zum Spielende `waiting`. Aufgeschobene Wuensche: `docs/changes.md`.

## Lokale Startbefehle

```powershell
npm install
Copy-Item .env.example .env      # DATABASE_URL, Ports anpassen
npm --prefix apps/server run dev # http://127.0.0.1:3000
npm --prefix apps/web run dev    # http://127.0.0.1:5173
```

Details: Abschnitt "Lokal starten" in `README.md`; Task-/Evidence-Nachweise:
`tasks/state.json`, `tasks/evidence/`, `tasks/reviews/`.
