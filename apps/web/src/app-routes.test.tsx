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
    ["/", "Prinzgame"],
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