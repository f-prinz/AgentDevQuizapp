# FEAT-20 — Automatischer Reconnect (Fast Path)

## User Story

Als Teilnehmer (Host, Spieler, Projektor) moechte ich, dass die App einen
abgebrochenen Lobby-WebSocket automatisch wieder aufbaut, damit ich nach
kurzen Unterbrechungen (z. B. Display-Sperre am Smartphone) ohne
manuellen Reload weitermachen kann.

## Hintergrund

`useLobbySnapshot` in `apps/web/src/routes/Pages.tsx` oeffnet einen
WebSocket pro Mount. Es gibt keinen `onclose`-Handler, keinen Heartbeat
und `send` verwirft Kommandos bei `readyState !== OPEN` still. Nach
einem Transport-Verlust bleibt die UI intakt, aber tot — nur ein Reload
hilft. Serverseitige Session-Wiederaufnahme via `auth`
(lobbyId/sessionId/token) existiert bereits (`reconnect.test.ts`),
der `lastRevision`-Guard verhindert Snapshot-Rueckschritte.

## Akzeptanzkriterien

- Schliesst der Socket (onclose), startet die App einen begrenzten
  Reconnect: max. **3 Versuche**, Backoff **2s / 5s / 10s**.
- Bei `visibilitychange` (Seite wieder sichtbar), `online` und
  `pageshow` prueft die App sofort: ist der Socket `CLOSED`, wird der
  Reconnect sofort ausgeloest (ausstehender Timer verworfen) — der
  Mobile-Fall "Entsperren" wartet nicht auf den Backoff.
- Waehrend Retries zeigt die UI eine Zwischenmeldung ("Verbindung
  unterbrochen — neuer Verbindungsaufbau …"), nach Erschoepfung eine
  Fehlermeldung mit **Erneut-verbinden-Button**, der das Budget
  zuruecksetzt und sofort neu verbindet.
- Fatal-Errors (`LOBBY_NOT_FOUND`, `UNAUTHORIZED`) retriggern **nie** —
  die Sitzung ist verloren, die bestehende Meldung bleibt.
- Ein erfolgreicher Reconnect setzt das Retry-Budget zurueck (erster
  empfangener Snapshot = stabile Verbindung); `lastRevision` verhindert
  veraltete Snapshots.
- Gilt fuer Host-, Spieler- und Projektor-Seite (gleicher Hook, alle
  `LobbyStatus`-Aufrufstellen zeigen ggf. den Button).
- Unmount-/Cleanup-Schliessungen triggern keinen Retry.

## Stack-Entscheidungsnotiz

KEEP — React-Hook-Erweiterung, keine Contract-/Server-Aenderung, keine
neue Dependency, kein neuer Endpunkt. Native `WebSocket`-Events +
`document.visibilitychange`/`window.online`/`pageshow`.

## Geklaerte Rueckfragen

Mit Nutzerbestaetigung ("gut so, bitte umsetzen") uebernommene Defaults:

- Retry-Budget: 3 Versuche, Backoff 2s/5s/10s (statt unbegrenzt).
- Gilt fuer alle Rollen (gemeinsamer Hook).
- UI waehrend Retry: Zwischenmeldung statt sofortiger Fehlermeldung;
  finaler Fehler + manueller Button erst nach Erschoepfung.
- Kein Client-Ping-Protokoll (Contract-Change vermieden) — `onclose` +
  Lifecycle-Events reichen fuer den Mobile-Fall.
