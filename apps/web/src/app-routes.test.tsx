import { fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { appRoutes } from "./app-routes";

function renderAt(path: string) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  return render(<RouterProvider router={router} />);
}

describe("role route smoke checks", () => {
  it.each([
    ["/", "Raccoons-Quiz"],
    ["/lobbies/lobby-123/host", "Hostbereich"],
    ["/join", "Lobby beitreten"],
    ["/player", "Spieleransicht"],
  ])("renders the expected page for %s", (path, heading) => {
    renderAt(path);
    expect(screen.getByRole("heading", { level: 1, name: heading })).toBeTruthy();
  });

  it("shows the ranking region and game display on the projector route without a page heading", () => {
    renderAt("/projector");
    expect(screen.getByRole("region", { name: "Rangliste" })).toBeTruthy();
    // CHG-5: Der Projektor nutzt die gesamte Seite — kein sichtbarer h1-Header.
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    expect(screen.getByRole("main").className).toContain("projector");
    expect(document.querySelector(".projector-layout")).toBeTruthy();
  });
});

describe("FEAT-17 theme toggle", () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    vi.unstubAllGlobals();
  });

  it.each(["/", "/projector", "/admin"])("renders the toggle button on %s", path => {
    renderAt(path);
    expect(screen.getByRole("button", { name: /modus/i })).toBeTruthy();
  });

  it("defaults to dark, switches to light on click and persists the choice", () => {
    renderAt("/");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    fireEvent.click(screen.getByRole("button", { name: /hellen modus/i }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(localStorage.getItem("theme")).toBe("light");
    expect(screen.getByRole("button", { name: /dunklen modus/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /dunklen modus/i }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(localStorage.getItem("theme")).toBe("dark");
  });

  it("restores a persisted light choice", () => {
    localStorage.setItem("theme", "light");
    renderAt("/");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(screen.getByRole("button", { name: /dunklen modus/i })).toBeTruthy();
  });

  it("follows prefers-color-scheme when nothing is persisted", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: /light/.test(query), media: query, addEventListener: () => {}, removeEventListener: () => {} }));
    renderAt("/");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
});