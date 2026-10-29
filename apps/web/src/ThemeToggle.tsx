import { useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "dark" | "light";
const STORAGE_KEY = "theme";

// FEAT-17: Reihenfolge — gespeicherte Wahl, dann prefers-color-scheme,
// sonst Dark (bisheriges Design bleibt Default). Das Theme steuert ausschliesslich
// das data-theme-Attribut auf :root; alle Farben laufen ueber CSS-Variablen.
function initialTheme(): Theme {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    const current = initialTheme();
    applyTheme(current);
    return current;
  });
  const next = theme === "dark" ? "light" : "dark";
  const toggle = () => {
    setTheme(next);
    applyTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
  };
  // Das Icon zeigt den Zielzustand: Sonne = heller Modus, Mond = dunkler Modus.
  return <button type="button" className="theme-toggle" onClick={toggle}
    aria-label={next === "light" ? "Zum hellen Modus wechseln" : "Zum dunklen Modus wechseln"}>
    {next === "light" ? <Sun aria-hidden /> : <Moon aria-hidden />}
  </button>;
}
