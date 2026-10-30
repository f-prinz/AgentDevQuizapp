import { readFileSync } from "node:fs";
import { cleanup, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { appRoutes } from "./app-routes";

const narrowViewportWidth = 320;
const desktopMinimumWidth = 1024;
const originalInnerWidth = window.innerWidth;
const styleElements: HTMLStyleElement[] = [];

function loadStylesheet(path: string) {
  const style = document.createElement("style");
  style.textContent = readFileSync(new URL(path, import.meta.url), "utf8");
  document.head.append(style);
  styleElements.push(style);
}

function renderAt(path: string) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  return render(<RouterProvider router={router} />);
}

function minWidthInPixels(element: Element) {
  const minWidth = getComputedStyle(element).minWidth;
  const match = minWidth.match(/^([\d.]+)(px|rem)$/);
  if (!match) return 0;

  const value = Number(match[1]);
  return match[2] === "rem" ? value * 16 : value;
}

function gridTrackCount(template: string) {
  let depth = 0;
  let tracks = 0;
  let inTrack = false;

  for (const character of template.trim()) {
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;

    if (/\s/.test(character) && depth === 0) {
      if (inTrack) tracks += 1;
      inTrack = false;
    } else {
      inTrack = true;
    }
  }

  return tracks + Number(inTrack);
}

beforeAll(() => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: narrowViewportWidth,
  });

  loadStylesheet("./styles/theme.css");
  loadStylesheet("./styles/app.css");
});

afterAll(() => {
  cleanup();
  for (const style of styleElements) style.remove();
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: originalInnerWidth,
  });
});

describe("projector layout at narrow viewport widths", () => {
  it("keeps desktop width and side-by-side regions on the projector route", () => {
    renderAt("/projector");

    const projector = screen.getByRole("main", { name: "Projektor" });
    const layout = projector.querySelector(".projector-layout");

    expect(window.innerWidth).toBeLessThan(desktopMinimumWidth);
    expect(minWidthInPixels(projector)).toBeGreaterThanOrEqual(desktopMinimumWidth);
    expect(layout).not.toBeNull();
    expect(getComputedStyle(layout!).display).toBe("grid");
    expect(gridTrackCount(getComputedStyle(layout!).gridTemplateColumns)).toBeGreaterThanOrEqual(2);
  });

  it.each([
    ["host", "/lobbies/lobby-123/host", "Hostbereich"],
    ["player", "/player", "Spieleransicht"],
  ])("keeps the %s content within the narrow viewport", (_role, path, heading) => {
    renderAt(path);

    const page = screen.getByRole("main");
    expect(screen.getByRole("heading", { level: 1, name: heading })).toBeTruthy();
    expect(minWidthInPixels(page)).toBeLessThanOrEqual(window.innerWidth);
    expect(minWidthInPixels(document.querySelector(".app-shell")!)).toBeLessThanOrEqual(window.innerWidth);
  });
});

// CHG-16: Neutrale graue Karten tragen im Light-Theme weissen Text auf
// hellem Grund — der Token --color-on-grey liefert pro Theme die lesbare
// Textfarbe (hell auf dunklem, dunkel auf hellem Kartengrund).
describe("neutral card text colour token", () => {
  const allStyles = () => styleElements.map(el => el.textContent).join("\n");

  it("defines --color-on-grey for dark and light themes", () => {
    expect(allStyles()).toContain("--color-on-grey:");
    expect(allStyles()).toContain('[data-theme="light"]');
  });

  it("uses the token on neutral grey answer cards instead of white", () => {
    expect(allStyles()).toMatch(/\.answer-tile[^}]*color:\s*var\(--color-on-grey\)/);
    expect(allStyles()).toMatch(/\.answer-option[^}]*color:\s*var\(--color-on-grey\)/);
  });
});

// CHG-17: Projektor-Tabellen — Basis kleiner als bisher, die ersten drei
// Zeilen (beste Spieler) gestaffelt groesser: Platz 1 > 2 > 3 > Rest.
describe("projector table row sizing", () => {
  const styles = () => styleElements.map(el => el.textContent).join("\n");
  const fontSizeOf = (selector: string) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = styles().match(new RegExp(escaped + "[^{}]*\\{[^}]*font-size:\\s*([^;}]+)"));
    return match?.[1]?.trim() ?? null;
  };
  const tables = [".projector-ranking .ranking-table", ".projector-layout .results-table"];

  it("shrinks the projector table base font below the former minimum", () => {
    for (const table of tables) {
      const size = fontSizeOf(table);
      expect(size, `${table} hat keine Basis-font-size`).toBeTruthy();
      // Bisherige Mindestgroessen waren 1.05rem (Rangliste) bzw. 1rem (Ergebnisse).
      const min = size!.match(/[\d.]+/)?.[0];
      expect(parseFloat(min!), `${table} Basis nicht kleiner`).toBeLessThanOrEqual(0.95);
    }
  });

  it("scales the first three table rows down by position", () => {
    for (const table of tables) {
      const sizes = [1, 2, 3].map(n => fontSizeOf(`${table} tbody tr:nth-child(${n})`));
      sizes.forEach((size, i) => expect(size, `${table} Zeile ${i + 1} ohne Regel`).toBeTruthy());
      const em = sizes.map(size => parseFloat(size!));
      expect(em[0]).toBeGreaterThan(em[1]);
      expect(em[1]).toBeGreaterThan(em[2]);
      // Alle drei bleiben groesser als die Basis-Zeilen.
      expect(em[2]).toBeGreaterThan(1);
    }
  });
});

// CHG-18: Kein Abstand unter den Section-Headern von Rangliste und
// Ergebnisse — beide teilen dieselbe h2-Regel.
describe("projector section header spacing", () => {
  const styles = () => styleElements.map(el => el.textContent).join("\n");

  it("sets margin-bottom: 0 on the shared ranking/results h2 rule", () => {
    expect(styles()).toMatch(/\.projector-ranking h2,\s*\.results h2\s*\{[^}]*margin-bottom:\s*0/);
  });
});
