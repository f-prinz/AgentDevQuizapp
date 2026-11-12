import { useEffect, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

// Redesign: Frage klein ueber den Antworten (zwei Zeilen), per Tippen gross —
// fuer alle, die den Beamer schlecht lesen koennen. Rein lokal, sendet nichts.
export function QuestionPeek({ question }: { question: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [question]);
  return <button type="button" className={`question-peek${open ? " question-peek--expanded" : ""}`} aria-expanded={open} onClick={() => setOpen(value => !value)}>
    <span className="question-peek-text">{question}</span>
    {open ? <Minimize2 aria-hidden className="question-peek-icon" /> : <Maximize2 aria-hidden className="question-peek-icon" />}
  </button>;
}
