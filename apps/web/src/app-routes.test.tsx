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
    ["/projector", "Projektor"],
  ])("renders the expected page for %s", (path, heading) => {
    renderAt(path);
    expect(screen.getByRole("heading", { level: 1, name: heading })).toBeTruthy();
  });

  it("shows separate display and ranking regions on the projector route", () => {
    renderAt("/projector");
    expect(screen.getByRole("region", { name: "Spielanzeige" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Rangliste" })).toBeTruthy();
  });
});