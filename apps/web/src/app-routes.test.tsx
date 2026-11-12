import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
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

  it("shows the projector layout without a page heading", () => {
    renderAt("/projector");
    // CHG-5: Der Projektor nutzt die gesamte Seite — kein sichtbarer h1-Header.
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    expect(screen.getByRole("main").className).toContain("projector");
    expect(document.querySelector(".projector-layout")).toBeTruthy();
  });
});

// Redesign: Nur noch das dunkle Raccoons-Design — kein Theme-Umschalter.
describe("single raccoons theme", () => {
  it.each(["/", "/projector", "/admin"])("renders no theme toggle and sets no data-theme on %s", path => {
    renderAt(path);
    expect(screen.queryByRole("button", { name: /modus|theme|hell|dunkel/i })).toBeNull();
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });
});