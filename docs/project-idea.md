# Projektidee: RaccoonsQuizgame

Quelle: `Raccoons-Quiz.md` (Original-Spezifikation, gilt ergaenzend).

Mehrspieler-Quiz-Webanwendung (MVP). Ein Host eroeffnet eine Lobby,
beliebig viele Spieler treten per Link bei, ein "Projektor" zeigt das
Geschehen auf einem Desktop-Bildschirm an. Gespielt werden mehrere Spiele verschiedener
Spielarten (Quiz, Sortieren, Schaetzen); zwischen den Spielen zeigt eine
Uebersicht das Ranking.

## Rollen

- **Host** — eroeffnet die Lobby, waehlt Spiele aus, startet
  Spielphasen, loest Auswertungen auf, fuehrt zurueck zur Uebersicht.
  Smartphone-Ansicht. Der Host ist KEIN Spieler (reine Moderationsrolle,
  nicht in der Teilnehmerliste).
- **Spieler** — tritt per Lobby-Link bei, vergibt sich einen Namen
  (max. 20 Zeichen; ohne Namen Anzeige als "Spieler <lfd. Nr.>"),
  beantwortet Fragen. Smartphone-Ansicht (Mobile First).
- **Projektor** — tritt ueber einen eigenen Link bei, zeigt nur an
  (Fragen, Regeln, Ranking, Auswertungen). Immer Desktop-Ansicht.

## Feature-Pakete

### F1 Lobby

- Host eroeffnet Lobby mit eindeutiger ID; die Spielerzahl ist
  unbegrenzt (kein Limit, keine Konfiguration der Maximalzahl).
- Der Host kann das Spiel jederzeit starten, sobald mindestens 2 Spieler
  beigetreten sind.
- Anzeige eines Beitritts-Links (mit ID); Oeffnen des Links fuehrt in die
  Lobby; dort Namenseingabe (max. 20 Zeichen).
- Separater Beitritts-Link fuer den Projektor.
- Lobby-Anzeige fuer Host und Spieler: Teilnehmerliste; Spieler ohne Namen
  erscheinen als "Spieler <Nr.>".

### F2 Uebersicht / Ranking

- Spieler sehen eigenen Namen und nach der 1. Runde ihre Punkte;
  oben immer Name, Punkte und aktuelle Platzierung.
- Projektor: links ungespielte Spiele ("Spielart: Titel"), rechts
  gespielte Spiele, zentral Ranking-Tabelle
  (Kopf: Platzierung, Punkte, Spielername, Spiel 1..n — nur bereits
  gespielte Spiele; Zeilen: Platz, Gesamtpunkte, Name, Punkte je Spiel).
  Ohne gespieltes Spiel nur Spielernamen.
- Animierter Ranking-Uebergang nach einem Spiel: altes Ranking → Spiel
  einblenden → Punkte hochzaehlen → Reihenfolge umsortieren.
- Host: Liste gespielte/verfuegbare Spiele; Auswahl hebt Spiel hervor
  (abwaehlbar); bei Auswahl Button "Starten" + Regelanzeige.

### F3 Spielphasen (gemeinsam fuer alle Spielarten)

- Startphase: Spieler sehen Titel + Start-Animation; Projektor sieht
  Titel + Regeln; Host sieht Titel + Start-Button (Start der Spielphase).
- Spielphase: spielartspezifisch.
- Auswertungsphase: spielartspezifisch; danach Rueckkehr zur Uebersicht
  (Host-Button "beenden"/"weiter").

### F4 Spielart Quiz

- Regeln: alle Spieler gleichzeitig und unabhaengig; richtige Antwort
  1 Punkt; 30s pro Frage; Antwort innerhalb der Zeit aenderbar, letzte
  Antwort zaehlt.
- Daten: beliebig viele Fragen; je Frage: Fragetext + 4 Antwortoptionen,
  genau eine richtig.
- Spielphase: Spieler waehlen eine Antwortoption; Projektor sieht die
  Frage; Host sieht Frage + Antwortoptionen.
- Auswertung: Projektor/Host sehen Frage + richtige Antwort; Spieler
  sehen eigene und richtige Antwort markiert.

### F5 Spielart Sortieren

- Regeln: Begriffe in richtige Reihenfolge bringen; 60s Zeit;
  richtig eingeordneter Begriff gibt 1 Punkt.
- Daten: Fragetext + Begriffe, jeder Begriff hat einen Wert (wird erst in
  der Auswertung angezeigt).
- Spielphase: Projektor/Host sehen die Frage; Spieler sehen Begriffe in
  zufaelliger Reihenfolge und sortieren per Drag-and-Drop.
- Auswertung: Projektor zeigt richtige Reihenfolge mit Werten + Fehler je
  Spieler; Spieler sehen eigene Reihenfolge farbig markiert
  (richtig/falsch); Host-Button "beenden" → Uebersicht.

### F6 Spielart Schaetzen

- Regeln: Schaetzwert (Zahl) zum Titel abgeben; Punkte relativ zu den
  anderen: oberes Drittel 3, mittleres 1, unteres 0; beste Schaetzung
  zusaetzlich +2 (max. 5). Zeitlimit: 30s (Entscheidung O1).
- Daten: Fragetext + richtiger Wert (Zahl).
- Spielphase: Projektor/Host sehen die Frage; Spieler haben ein
  Zahleneingabefeld.
- Auswertung: Projektor zeigt Spieler nach Platzierung sortiert mit
  Abstand zum richtigen Wert; Spieler sehen eigene Eingabe + Abstand;
  Host-Button "weiter" → Uebersicht.

### F7 Echtzeit-/Timer-Regeln

- Waehrend der Spielphase hat jeder Spieler einen "abgeben"-Button: danach
  ist die Antwort final und die Runde endet vorzeitig, wenn alle
  abgegeben haben.
- Bei Zeitablauf zaehlt die zuletzt gewaehlte Antwort/Reihenfolge/Eingabe.
- Timeranzeige in allen Ansichten; bei Spielern klein, auf dem Projektor
  gross; Timer sollen synchronisiert sein (Serverzeit).
- Latenzausgleich: Antworten werden bis Zeitablauf + 2s akzeptiert.
- Nach Zeitablauf + 2s sieht der Host den Button "aufloesen" → startet
  die Auswertungsphase.

### F8 Reconnect

- Bei Verbindungsverlust reicht Refresh oder erneutes Oeffnen des Links,
  um wieder beizutreten (Session-Wiederherstellung).

### F9 Design / Darstellung

- Mobile First fuer Spieler + Host; Projektor immer Desktop.
- Farben: tuerkis `#48A3AE`, rot `#FE0000`, grau `#706A6A`,
  Hintergrund `#1D1D1B`.
- Antwort-Markierung: neutral `#706A6A`, richtig `#48A3AE`,
  falsch `#FE0000`.

## Technische Rahmenbedingungen (Vorschlag des Nutzers)

- Frontend: React + Vite + TypeScript; Backend: Node-Server
  (Fastify + ws); DB: PostgreSQL via pg (freigegebener Stack, siehe
  `docs/tech-stack.md`).
- Mehrspieler-Echtzeit via WebSocket + REST fuer Lobby-Setup.
- Spielinhalte (Quiz-/Sortier-/Schaetzdaten) als Seed-Datei(en) beim
  Serverstart in die DB laden (Entscheidung O2); alle vorhandenen Spiele
  stehen jeder Lobby zur Verfuegung (O5).
- Persistenz: nur Spielinhalte/Katalog persistent; Lobbysitzungen und
  Ergebnisse werden NICHT ueber den Serverneustart hinaus gespeichert
  (Entscheidung O6 — keine Historie, kein Login).
- Lokal laufend, kein Deployment.

## MVP-Scope

Alles oben Genannte ist MVP. Explizit NICHT im MVP (aufzunehmen in
`docs/changes.md`, falls gewuenscht): Accounts/Login, Inhalts-Editor,
Spielhistorie ueber Serverneustart hinaus, weitere Spielarten, Sound.

## Geklaerte Fragen (Entscheidungen des Nutzers, 2026-10-26)

- O1 Schaetzen-Zeitlimit: 30s (Widerspruch in `Raccoons-Quiz.md` zugunsten
  des Regeltextes aufgeloest; Projektor-Kurzform entsprechend anpassen).
- O2 Spielinhalte: Seed-Datei(en) mit Beispielsets, beim Serverstart
  geladen; kein Editor im MVP.
- O3 Host zaehlt NICHT zur Spielerzahl (reine Moderationsrolle).
- O4 GEaENDERT: Spielerzahl ist unbegrenzt; der Host darf jederzeit
  starten, sobald mindestens 2 Spieler beigetreten sind.
- O5 Alle vorhandenen Spiele stehen jeder Lobby als Katalog zur Verfuegung.
- O6 Abgeschlossene Spiele/Lobbies werden nicht persistent gespeichert.
