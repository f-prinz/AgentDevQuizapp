# RaccoonsQuizgame

Ich möchte eine Webanwendung bauen, die als interaktives Spiel fungiert.  
Dabei möchte ich ein MVP bauen, bei dem folgendes inkludiert ist

# Lobby

- ich kann als Host eine Lobby eröffnen, die eine eindeutige ID hat  
  - die Lobby soll 2-4 Spieler haben können, was der Host konfigurieren kann  
- während ich mich in der Lobby befinde, soll ein Link (mit der ID) angezeigt werden, mit dem Spieler der Lobby beitreten können  
  - wenn ein Spieler den Link im Browser öffnet, gelangt er in die Lobby  
  - dort muss er sich einen Namen geben (max 20 Zeichen)  
- dem Host und den Spielern wird die Lobby angezeigt  
  - Spieler, die noch keinen Namen haben, werden zunächst nur als Spieler \+ laufende Nummer angezeigt  
- Neben dem Host soll es eine weitere Rolle geben, den “Projektor ”. Dieser tritt über einen eigenen Link der Lobby bei

# Übersicht

### Ansichten

- die Spieler sehen ihren Namen (und nach der 1\. Runde darunter ihre erzielten Punkte)  
- der Projektor sieht links die nicht gespielten Spiele (“Spielart”: “Titel”), rechts die gespielten Spiele und zentral folgendes Ranking als Tabelle:  
  - Kopfzeile: Platzierung, Punkte, Spielername, Spiel 1, Spiel 2, Spiel 3, …  
    - dabei werden nur die Spiele angezeigt, die bereits gespielt wurden  
  - Zeilen (für jeden Spieler eine): Platz, Gesamtpunkte, Spielername, Punkte in Spiel 1, Punkte in Spiel 2, Punkte in Spiel 3, …  
  - Ausnahme. wenn noch kein Spiel gespielt wurde, sieht der Projektor nur die Spielernamen  
  - wenn nach einem Spiel in die Übersicht zurückgewechselt wird, soll erst das alte Ranking angezeigt werden, dann mit einer Animation das Spiel hinzugefügt, die Punkte mit einer Animation hochgezählt und dann die Reihenfolge mit einer Animation geändert werden  
- der Host sieht die gespielten und verfügbaren Spiele und kann ein verfügbares Spiel auswählen. Dieses wird dann hervorgehoben. Er kann es auch wieder abwählen. Ist ein Spiel gewählt, erscheint unten ein Button “Starten” und die Regeln des Spiels werden angezeigt.

# Spielarten

Das Spiel soll mehrere Spielarten haben. Es kann mehrere Spiele mit der gleichen Spielart geben.

## Spielphasen

Jedes Spiel hat mehrere Phasen: Startphase, Spielphase und Auswertungsphase. Die Startphase ist immer gleich:

- die Spieler sehen den Quiztitel und eine Animation, die andeutet, dass es gleich losgeht  
- der Projektor sieht den Quiztitel und die Regeln  
- der Host sieht den Quiztitel und einen Start-Button. Wenn er den drückt, startet die Spielphase 

Nach der Auswertungsphase wird wieder die Übersicht angezeigt.

## Quiz

### Regeln

- Die Spieler spielen gleichzeitig und unabhängig voneinander  
- Jede richtige Antwort gibt 1 Punkt  
- Jede Frage muss innerhalb 30s beantwortet werden  
- Die Antwort kann innerhalb der 30s noch geändert werden, die letzte Antwort zählt

#### Kurzform für Projektor

- Spieler spielen gleichzeitig  
- richtige Antwort 1 Punkt  
- 30s pro Frage (Antwort kann geändert werden, letzte Antwort zählt)

### Datenstruktur

- Quizfrage   
- beliebig viele Fragen  
- eine Quizfrage hat eine Frage und vier Antwortmöglichkeiten, wovon nur eine richtig ist

### Ansichten

Spielphase

- die Spieler sehen die Antwortmöglichkeiten und können eine davon auswählen.   
- der Projektor sieht die Quizfrage  
- der Host sieht Frage und die Antwortmöglichkeiten

Auswertungsphase:

- der Projektor sieht die Quizfrage und die richtige Antwort  
- der Host sieht die Quizfrage und die richtige Antwort  
- die Spieler sehen die eigene und richtige Antwort markiert

## Sortieren

### Regeln

- Hier geht es darum, dass die Spieler die vorgegebenen Begriffe/Dinge in die richtige Reihenfolge bringen  
- Die Spieler haben dafür 60s Zeit

#### Kurzform für Projektor

- Spieler spielen gleichzeitig  
- richtig eingeordnet gibt 1 Punkt  
- 60s Zeit

### Datenstruktur

- Quizfrage   
- Begriffe  
- jeder Begriff hat einen Wert (der jedoch erst am Ende anzeigt wird)

### Ansichten

Spielphase:

- der Projektor sieht die Quizfrage  
- der Host sieht den Quizfrage  
- die Spieler sehen alle Begriffe in zufälliger Reihenfolge. Die Spieler können die Begriffe per drag-and-drop verschieben und somit die Reihenfolge ändern

Auswertungsphase:

- der Projektor zeigt die richtige Reihenfolge an (mit Wert) und welcher Spieler wie viele Fehler gemacht hat  
- der Host sieht den Button “beenden”, welcher alle zurück zur Übersicht führt  
- die Spieler sehen farbig markiert, welche richtig und welche falsch einsortiert sind. 

## Schätzen

### Regeln

- Hier geht es darum, dass die Spieler zum vorgegebenen Titel eine Schätzung abgeben.  
- Punkte werden vergeben, wie nah man dran ist im Vergleich zu anderen. Oberes Drittel: 3 Punkte, mittleres Drittel: 1 Punkt, unteres Drittel: 0 Punkte. Beste Schätzung zusätzlich 2 Punkte (also insgesamt 5\)  
- Die Spieler haben dafür 30s Zeit

#### Kurzform für Projektor

- Spieler spielen gleichzeitig  
- Punkte werden vergeben, wie nah man dran ist im vergleich zu anderen. Oberes Drittel: 3 Punkte, mittleres Drittel: 1 Punkt, unteres Drittel: 0 Punkte. Beste Schätzung zusätzlich 2 Punkte (also insgesamt 5\)  
- 60s Zeit

### Datenstruktur

- Quizfrage   
- Wert (Zahl)

### Ansichten

Spielphase:

- der Projektor sieht die Quizfrage  
- der Host sieht den Quizfrage  
- die Spieler haben ein Eingabefeld (Zahl), in dem sie ihre Schätzung eintragen können

Auswertungsphase:

- der Projektor zeigt die Spieler und deren Abstand zum richtigen Wert an (Spieler in der Reihenfolge der Platzierung sortiert)  
- der Host sieht den Button “weiter”, welcher alle zurück zur Übersicht führt  
- die Spieler sehen ihre Eingabe und den Abstand zum richtigen Wert

# Darstellung

- die Ansichten der Spieler und des Hosts sollten auf dem Smartphone gut nutzbar sein. Hier gilt Mobile First  
- die Ansicht des Projektors ist immer eine Desktopansicht  
- Farbgebung: türkis \#48A3AE, rot \#FE0000, grau \#706A6A. Hintergrund \#1D1D1B  
  - Farbgebung Antworten: Antworten sind zunächst in neutraler Farbe. Sobald die Antwort aufgelöst wird, wird die Antwort farbig markiert.   
    - neutral: \#706A6A  
    - richtig \#48A3AE  
    - falsch \#FE0000  
- die Spieler sehen oben immer ihren Namen, ihre Punkte und ihre derzeitige Platzierung

# Sonstiges

- wenn ein Spieler die Verbindung verliert, soll er über ein Refresh oder erneutes Öffnen des Links wieder beitreten können  
- Technische Umsetzung: Frontend möglichst reactJS, Backend nodeserver, Datenbank postgresql  
- während Quizrunde haben Spieler unten immer den Button “abgeben”, mit dem die Antwort final gespeichert wird. Danach kann die Antwort nicht mehr geändert werden. Wenn das alle gemacht haben, wird die Quizrunde beendet  
- Wenn die Zeit abläuft zählt immer die zuletzt ausgewählte Antwort/Reihenfolge/Eingabe  
- während der Quizrunden sehen Host, Projektor und Spieler immer einen ablaufenden Timer dieser soll bei den Spielern nur klein angezeigt werden, auf dem Projektor recht groß  
- wenn möglich sollten die Timer synchronisiert sein  
- aufgrund von Latenzen sollten Antworten nach \+2 Sekunden noch akzeptiert werden  
- Nach Ablauf der Zeit \+2 Sekunden sieht der Host immer den Button “auflösen”. Wenn er den klickt, startet die Auflösung und Auswertung

