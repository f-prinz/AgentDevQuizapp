// TECH-16: Regeltext und Punktevergabe gehoeren zur Spielart, nicht zum
// hochgeladenen Spiel — daher hier hardcoded. Werte zentral anpassen, um sie
// fuer ALLE Spiele einer Spielart zu aendern.
export const GAME_CONFIG = {
  quiz: {
    rules: 'Beantwortet jede Frage. Jede richtige Antwort gibt einen Punkt.',
    scoring: {
      // Punkte pro richtig beantworteter Frage.
      pointsPerCorrectAnswer: 1,
    },
  },
  sorting: {
    rules: 'Ordnet die Begriffe in der richtigen Reihenfolge. Jede richtige Position: 1 Punkt.',
    scoring: {
      // Punkte pro Begriff an der korrekten Position.
      pointsPerCorrectPosition: 1,
    },
  },
  estimation: {
    rules: 'Schätzt möglichst genau. Die Punkte richten sich nach dem Abstand. Beste Schätzung 5 Punkte, oberes Drittel 3 Punkte, mittleres Drittel 1 Punkt, unteres Drittel 0 Punkte',
    scoring: {
      // Punkte nach Drittel-Einstufung der Schätzabstände …
      upperThird: 3,
      middleThird: 1,
      lowerThird: 0,
      // … plus Bonus für die beste Schätzung (ergibt upperThird + bestBonus = 5).
      bestBonus: 2,
    },
  },
} as const;

export type GameConfig = typeof GAME_CONFIG;
