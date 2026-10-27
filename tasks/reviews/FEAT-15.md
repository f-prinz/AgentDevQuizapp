# Code Review FEAT-15

Reviewer: `code_reviewer`, unabhaengig von `web_developer`.

## Ergebnis: APPROVED

Der aktuelle Diff bleibt im freigegebenen Web-Stack (React/Vite/TypeScript,
native REST-/WebSocket-Clients, `localStorage`, Vitest/RTL, ESLint/tsc) und
veraendert weder `contracts/` noch Dependencies. Die Sitzungsschluessel sind
nach Lobby und Rolle getrennt; Host- und Projektor-Fragmente werden validiert,
gespeichert und aus der sichtbaren URL entfernt. Die WS-Fehlercodes
`LOBBY_NOT_FOUND` und `UNAUTHORIZED` werden ohne Tokenanzeige in eine klare
Meldung uebersetzt und die veraltete Sitzung wird entfernt. Die aktuellen
Tests decken Refresh ohne erneuten Join, stale Sessions,
Sessioninvalidierung beim Lobby-/Routenwechsel und Projektor-Refresh ab.

## Aufloesung des vorherigen Findings

Das Finding ist behoben. `JoinPage` setzt die vom Server bestaetigte Sitzung
zuerst in den React-State und markiert den Join als erfolgreich. Der
`localStorage`-Schreibversuch ist separat geschuetzt; bei deaktiviertem oder
vollem Storage bleibt die aktuelle Seite mit derselben Sitzung nutzbar und die
Join-Form wird nicht erneut angeboten. Der neue Test simuliert einen
`QuotaExceededError`, bestaetigt den erfolgreichen Status und stellt sicher,
dass genau ein REST-Join erfolgt.

## Kriterien, Stack und Regressionen

- Session-Token werden nur im vorhandenen `localStorage` pro Lobby/Rolle
  abgelegt; keine neue Persistenz oder Vertragsaenderung.
- WS-Reauth sendet den Token im Auth-Frame nach dem Verbindungsaufbau und nicht
  in der URL. Rollen- und Lobbybindung werden aus `SessionSchema` geprueft.
- Serverneustart-Fehler entfernen die lokale Sitzung und loesen keinen
  erneuten Join aus. `JoinPage` verwirft zusaetzlich die aktive In-Memory-
  Sitzung, leert den Snapshot und zeigt danach wieder das Join-Formular; ein
  spaeterer Lobby-/Routenwechsel kann dadurch keinen alten Token erneut
  authentifizieren. Die Meldung bleibt tokenfrei.
- `useLobbySnapshot` leert Snapshot und Verbindungsfehler bei Lobby-/Rollen-
  wechsel; die Session wird nur fuer die aktuelle `lobbyId` und Rolle als
  aktiv verwendet.
- Die Draft-/Final-/Deadline-Anzeige gehoert gemaess der Taskformulierung zur
  spaeteren FEAT-4-Integration und wird hier nicht als implementiert bestaetigt.
- Keine Duplikation vorhandener Server-Sessionlogik, keine unfreigegebenen
  Frameworks oder Dependencies.
- Das zuvor offene P1-Finding ist mit dem aktuellen Diff aufgeloest; keine
  weiteren Code-, Scope- oder Stack-Findings.

## Ausgefuehrte Pruefungen

| Befehl | Ergebnis |
| --- | --- |
| `npm --prefix apps/web test` | Exit 0, 3 Dateien / 19 Tests |
| `npm --prefix apps/web run lint` | Exit 0, ESLint und `tsc --noEmit` |
| `npm --prefix apps/web run build` | Exit 0, Vite-Produktionsbuild erfolgreich |
| `git diff --check` | Exit 0 |

Die rote Evidence `FEAT-15-2026-10-27T08-43-05-834Z.json` ist als historischer
TDD-Nachweis nachvollziehbar; die nachfolgende Test-Evidence ist gruen.

