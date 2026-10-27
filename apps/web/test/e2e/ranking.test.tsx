import { act, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { appRoutes } from "../../src/app-routes";

const lobbyId = "rank-lobby";
const catalog = [
  { id: "quiz-1", kind: "quiz", title: "Weltwissen", rules: "Eine Antwort", played: false },
  { id: "sort-1", kind: "sorting", title: "Jahre", rules: "Begriffe ordnen", played: false },
];
const participants = [
  { id: "player-1", name: "Ada", number: 1, connected: true, waiting: false },
  { id: "player-2", name: "Bo", number: 2, connected: true, waiting: false },
];

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
}

const token = "t".repeat(43);

function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    version: 1, type: "snapshot", lobbyId, revision: 1, serverTime: 1_000, phase: "overview",
    participants, catalog, selectedGameId: null, ranking: [], rankingTransition: null,
    role: "projector", playerLink: `/lobbies/${lobbyId}/join`, round: null, ...overrides,
  };
}

async function renderProjector() {
  vi.stubGlobal("WebSocket", FakeWebSocket);
  vi.stubGlobal("crypto", { ...globalThis.crypto, randomUUID: () => "uuid-test" });
  FakeWebSocket.instances = [];
  window.history.replaceState({}, "", `/lobbies/${lobbyId}/projector#sessionId=session-p&token=${token}`);
  const router = createMemoryRouter(appRoutes, { initialEntries: [`/lobbies/${lobbyId}/projector#sessionId=session-p&token=${token}`] });
  render(<RouterProvider router={router} />);
  await act(async () => {});
  const socket = FakeWebSocket.instances.at(-1);
  if (!socket) throw new Error("No WebSocket created.");
  return {
    socket,
    async deliver(value: unknown) { await act(async () => socket.deliver(value)); },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  FakeWebSocket.instances = [];
});

describe("e2e: ranking overview lifecycle on the projector", () => {
  it("grows the ranking table over two finished games with a transition", async () => {
    const view = await renderProjector();

    // Leere Uebersicht: keine Tabelle, nur Spielernamen.
    await view.deliver(snapshot());
    expect(screen.queryByRole("table")).toBeNull();
    const list = await screen.findByRole("region", { name: /rangliste/i });
    expect(list.textContent).toContain("Ada");
    expect(list.textContent).toContain("Bo");

    // Erstes Spiel gespielt: Rangliste nur mit Platz/Punkte/Name + Uebergangs-Animation (CHG-4).
    const afterOne = snapshot({
      revision: 2,
      catalog: catalog.map(entry => entry.id === "quiz-1" ? { ...entry, played: true } : entry),
      ranking: [
        { playerId: "player-1", name: "Ada", rank: 1, total: 3, games: [{ gameId: "quiz-1", points: 3 }] },
        { playerId: "player-2", name: "Bo", rank: 2, total: 1, games: [{ gameId: "quiz-1", points: 1 }] },
      ],
      rankingTransition: {
        resultId: "res-1", gameId: "quiz-1",
        previous: [
          { playerId: "player-1", name: "Ada", rank: 1, total: 0, games: [] },
          { playerId: "player-2", name: "Bo", rank: 2, total: 0, games: [] },
        ],
        current: [
          { playerId: "player-1", name: "Ada", rank: 1, total: 3, games: [{ gameId: "quiz-1", points: 3 }] },
          { playerId: "player-2", name: "Bo", rank: 2, total: 1, games: [{ gameId: "quiz-1", points: 1 }] },
        ],
      },
    });
    await view.deliver(afterOne);
    const table = await screen.findByRole("table");
    expect(table).toBeTruthy();
    await waitFor(() => expect(table.getAttribute("data-ranking-stage")).toBe("after"), { timeout: 6_000 });
    const headers = Array.from(table.querySelectorAll("th")).map(cell => cell.textContent);
    expect(headers).toEqual(["Platz", "Punkte", "Spielername"]);
    const firstRow = table.querySelectorAll("tbody tr")[0];
    expect(firstRow.textContent).toContain("Ada");
    expect(firstRow.textContent).toContain("3");
    const unplayedSection = screen.getByRole("region", { name: /offene spiele/i });
    expect(unplayedSection.textContent).toContain("Sortieren: Jahre");
    expect(unplayedSection.textContent).not.toContain("Weltwissen");
    const playedSection = screen.getByRole("region", { name: /gespielte spiele/i });
    expect(playedSection.textContent).toContain("Quiz: Weltwissen");

    // Zweites Spiel gespielt: weiterhin nur drei Spalten, neue Rangfolge.
    await view.deliver(snapshot({
      revision: 3,
      catalog: catalog.map(entry => ({ ...entry, played: true })),
      ranking: [
        { playerId: "player-2", name: "Bo", rank: 1, total: 6, games: [{ gameId: "quiz-1", points: 1 }, { gameId: "sort-1", points: 5 }] },
        { playerId: "player-1", name: "Ada", rank: 2, total: 4, games: [{ gameId: "quiz-1", points: 3 }, { gameId: "sort-1", points: 1 }] },
      ],
    }));
    const grownTable = await screen.findByRole("table");
    const grownHeaders = Array.from(grownTable.querySelectorAll("th")).map(cell => cell.textContent);
    expect(grownHeaders).toEqual(["Platz", "Punkte", "Spielername"]);
    expect(grownHeaders).not.toContain("Spiel 1");
    const grownRows = grownTable.querySelectorAll("tbody tr");
    expect(grownRows[0].textContent).toContain("Bo");
    expect(grownRows[0].textContent).toContain("6");
    expect(grownRows[1].textContent).toContain("Ada");
    expect(grownRows[1].textContent).toContain("4");
    expect(screen.getByRole("region", { name: /offene spiele/i }).textContent).toContain("Keine Spiele");
  });
});
