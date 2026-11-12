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

beforeAll(() => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: narrowViewportWidth,
  });

  loadStylesheet("./styles/theme.css");
  loadStylesheet("./styles/app.css");
  // Redesign: app.css bindet diese per @import ein — jsdom folgt @import nicht.
  loadStylesheet("./styles/ranking.css");
  loadStylesheet("./styles/projector.css");
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
  it("keeps desktop width and a grid layout on the projector route", () => {
    renderAt("/projector");

    const projector = screen.getByRole("main", { name: "Projektor" });
    const layout = projector.querySelector(".projector-layout");

    expect(window.innerWidth).toBeLessThan(desktopMinimumWidth);
    expect(minWidthInPixels(projector)).toBeGreaterThanOrEqual(desktopMinimumWidth);
    expect(layout).not.toBeNull();
    expect(getComputedStyle(layout!).display).toBe("grid");
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

// Redesign: Raccoons-Palette als Tokens, nur Dark, keine CDN-Schriften.
describe("raccoons design tokens", () => {
  const allStyles = () => styleElements.map(el => el.textContent).join("\n");

  it("defines the Raccoons palette tokens", () => {
    const css = allStyles().toLowerCase();
    expect(css).toContain("--rq-teal: #48a3ae");
    expect(css).toContain("--rq-red: #fe0000");
    expect(css).toContain("--rq-grey: #706a6a");
    expect(css).toContain("--rq-bg: #1d1d1b");
    expect(css).not.toContain('[data-theme="light"]');
  });

  it("switches off the start-title animation for reduced motion", () => {
    const blocks = allStyles().match(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\}\s*\}/g) ?? [];
    expect(blocks.some(block => block.includes(".projector-layout--start .projector-game-title"))).toBe(true);
  });

  it("loads no fonts from a CDN", () => {
    expect(allStyles()).not.toMatch(/fonts\.googleapis|@import\s+url\(\s*["']?http/i);
  });
});
