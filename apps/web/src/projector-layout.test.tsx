import { readFileSync } from "node:fs";
import { cleanup, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { appRoutes } from "./app-routes";

const narrowViewportWidth = 480;
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
    const layout = screen.getByRole("region", { name: "Spielanzeige" }).parentElement;

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
