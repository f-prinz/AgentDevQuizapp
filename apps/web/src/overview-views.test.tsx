import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appRoutes } from "./app-routes";

const lobbyId = "overview-lobby";

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  static readonly OPEN = 1;
  readyState = FakeWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onclose: (() => void) | null = null;
  readonly sent: string[] = [];
  constructor(readonly url: string) { FakeWebSocket.instances.push(this); queueMicrotask(() => this.onopen?.()); }
  send(value: string) { this.sent.push(value); }
  close() { this.readyState = 3; this.onclose?.(); }
  deliver(value: unknown) { this.onmessage?.({ data: JSON.stringify(value) } as MessageEvent<string>); }
  commands() { return this.sent.map(value => JSON.parse(value) as Record<string, unknown>); }
}

const token = "t".repeat(43);
const session = { lobbyId, sessionId: "session-1", role: "player", token };

const catalog = [
  { id: "quiz-1", kind: "quiz", title: "Weltwissen", rules: "Eine Antwort waehlen", played: false },
  { id: "sort-1", kind: "sorting", title: "Jahre ordnen", rules: "Begriffe sortieren", played: true },
];
const ranking = [
  { playerId: "player-1", name: "Ada", rank: 1, total: 5, games: [{ gameId: "sort-1", points: 5 }] },
  { playerId: "player-2", name: "Bo", rank: 2, total: 3, games: [{ gameId: "sort-1", points: 3 }] },
];

function base(overrides: Record<string, unknown> = {}) {
  return {
    version: 1, type: "snapshot", lobbyId, revision: 1, serverTime: 1_000,
    phase: "overview", round: null,
    participants: [
      { id: "player-1", name: "Ada", number: 1, connected: true, waiting: false },
      { id: "player-2", name: "Bo", number: 2, connected: true, waiting: false },
    ],
    catalog, selectedGameId: null, ranking: [], rankingTransition: null,
    ...overrides,
  };
}
function snapshot(role: "host" | "player" | "projector", overrides: Record<string, unknown> = {}) {
  const data: Record<string, unknown> = { ...base(overrides), role };
  if (role === "host") data.canStartLobby = true;
  if (role === "player") {
    data.playerId = "player-1";
    data.input = { answer: null, final: false, participating: true };
  }
  return data;
}
function renderRole(role: "host" | "player" | "projector") {
  localStorage.setItem(`lobby:${lobbyId}:${role}`, JSON.stringify({ ...session, role }));
  const path = `/lobbies/${lobbyId}/${role === "host" ? "host" : role === "player" ? "join" : "projector"}`;
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  const view = render(<RouterProvider router={router} />);
  return { ...view, socket: () => FakeWebSocket.instances.at(-1)! };
}
async function deliver(view: ReturnType<typeof renderRole>, value: unknown) {
  await waitFor(() => expect(FakeWebSocket.instances.length).toBeGreaterThan(0));
  await act(async () => view.socket().deliver(value));
}

beforeEach(() => {
  FakeWebSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeWebSocket);
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("FEAT-6 host overview", () => {
  it("lists available and played games and lets the host select and deselect", async () => {
    const view = renderRole("host");
    await deliver(view, snapshot("host"));
    const available = screen.getByRole("region", { name: /verfügbare spiele|verfuegbare spiele/i });
    const played = screen.getByRole("region", { name: /gespielte spiele/i });
    expect(available.textContent).toContain("Weltwissen");
    expect(available.textContent).not.toContain("Jahre ordnen");
    expect(played.textContent).toContain("Jahre ordnen");

    fireEvent.click(screen.getByRole("button", { name: /Weltwissen/i }));
    await waitFor(() => expect(view.socket().commands().some(command => command.type === "game.select" && command.gameId === "quiz-1")).toBe(true));

    await deliver(view, snapshot("host", { revision: 2, selectedGameId: "quiz-1" }));
    fireEvent.click(screen.getByRole("button", { name: /Weltwissen/i }));
    await waitFor(() => expect(view.socket().commands().some(command => command.type === "game.select" && command.gameId === null)).toBe(true));
  });

  it("highlights the selected game, shows its rules and a start button that prepares the round", async () => {
    const view = renderRole("host");
    await deliver(view, snapshot("host", { selectedGameId: "quiz-1" }));
    const selected = screen.getByRole("button", { name: /Weltwissen/i });
    expect(selected.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText(/Eine Antwort waehlen/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /starten/i }));
    await waitFor(() => expect(view.socket().commands().some(command => command.type === "game.prepare")).toBe(true));
  });
});

describe("FEAT-6 projector overview", () => {
  it("shows unplayed games on the left, played games on the right and the ranking in the center", async () => {
    const view = renderRole("projector");
    await deliver(view, snapshot("projector", { ranking }));
    const unplayed = screen.getByRole("region", { name: /offene spiele|ungespielte|verfügbare spiele|verfuegbare spiele/i });
    const played = screen.getByRole("region", { name: /gespielte spiele/i });
    expect(unplayed.textContent).toContain("Quiz: Weltwissen");
    expect(unplayed.textContent).not.toContain("Jahre ordnen");
    expect(played.textContent).toContain("Jahre ordnen");
  });

  it("renders the ranking table with columns only for played games", async () => {
    const view = renderRole("projector");
    await deliver(view, snapshot("projector", { ranking }));
    const table = screen.getByRole("table");
    const headers = Array.from(table.querySelectorAll("th")).map(cell => cell.textContent);
    expect(headers).toHaveLength(4);
    expect(headers[0]).toMatch(/platz/i);
    expect(headers[1]).toMatch(/punkte/i);
    expect(headers[2]).toMatch(/name|spieler/i);
    expect(headers[3]).toMatch(/spiel\s*1/i);
    const rows = table.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain("Ada");
    expect(rows[0].textContent).toContain("5");
  });

  it("shows only the player names when no game has been played", async () => {
    const view = renderRole("projector");
    await deliver(view, snapshot("projector", { catalog: catalog.map(entry => ({ ...entry, played: false })) }));
    expect(screen.queryByRole("table")).toBeNull();
    const list = await screen.findByRole("region", { name: /rangliste/i });
    expect(list.textContent).toContain("Ada");
    expect(list.textContent).toContain("Bo");
  });

  it("animates the ranking transition: previous standings first, then updated totals and order", async () => {
    const view = renderRole("projector");
    const previous = [
      { playerId: "player-2", name: "Bo", rank: 1, total: 3, games: [{ gameId: "sort-1", points: 3 }] },
      { playerId: "player-1", name: "Ada", rank: 2, total: 1, games: [{ gameId: "sort-1", points: 1 }] },
    ];
    const current = [
      { playerId: "player-1", name: "Ada", rank: 1, total: 6, games: [{ gameId: "sort-1", points: 1 }, { gameId: "quiz-1", points: 5 }] },
      { playerId: "player-2", name: "Bo", rank: 2, total: 3, games: [{ gameId: "sort-1", points: 3 }, { gameId: "quiz-1", points: 0 }] },
    ];
    await deliver(view, snapshot("projector", {
      ranking: current, catalog: catalog.map(entry => ({ ...entry, played: true })),
      rankingTransition: { resultId: "result-1", gameId: "quiz-1", previous, current },
    }));
    const table = await screen.findByRole("table");
    // Erst die alte Tabelle: Bo vor Ada, Ada mit 1 Punkt.
    const initialRows = table.querySelectorAll("tbody tr");
    expect(initialRows[0].textContent).toContain("Bo");
    expect(initialRows[1].textContent).toContain("1");
    // Nach der Animation: neue Reihenfolge und Ada mit 6 Punkten.
    await waitFor(() => {
      const rows = table.querySelectorAll("tbody tr");
      expect(rows[0].textContent).toContain("Ada");
      expect(rows[0].textContent).toContain("6");
    }, { timeout: 4000 });
  });
});
