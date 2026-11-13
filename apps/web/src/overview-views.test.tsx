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
  if (role === "host") {
    data.canStartLobby = true;
    data.links = { player: `/lobbies/${lobbyId}/join`, projector: `/lobbies/${lobbyId}/projector#sessionId=p&token=${token}` };
  }
  if (role === "projector") data.playerLink = `/lobbies/${lobbyId}/join`;
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
    // CHG-20: Das LobbyAccordion bringt 'Lobby starten' mit — /starten/i
    // waere jetzt mehrdeutig, deshalb der exakte Name.
    fireEvent.click(screen.getByRole("button", { name: /^starten$/i }));
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

  // Redesign: Rangliste als Podium (Platz 1-2-3 links -> rechts) + Feld.
  it("renders the ranking as podium with rank and total", async () => {
    const view = renderRole("projector");
    await deliver(view, snapshot("projector", { ranking }));
    const board = screen.getByRole("region", { name: /rangliste/i });
    const podium = Array.from(board.querySelectorAll(".ranking-podium [data-ranking-entry]"));
    expect(podium).toHaveLength(2);
    expect(podium[0].querySelector(".ranking-name")?.textContent).toBe("Ada");
    expect(podium[0].querySelector(".ranking-total")?.textContent).toBe("5");
    expect(podium[0].querySelector(".ranking-rank")?.textContent).toBe("1");
  });

  // Spec: Vor dem ersten Spiel sieht der Projektor nur die Spielernamen.
  it("shows only player names before any game", async () => {
    const view = renderRole("projector");
    await deliver(view, snapshot("projector", {
      catalog: catalog.map(entry => ({ ...entry, played: false })),
      ranking: [
        { playerId: "player-1", name: "Ada", rank: 1, total: 0, games: [] },
        { playerId: "player-2", name: "Bo", rank: 1, total: 0, games: [] },
      ],
    }));
    const list = await screen.findByRole("region", { name: /rangliste/i });
    expect(Array.from(list.querySelectorAll("ol.ranking-names li")).map(li => li.textContent)).toEqual(["Ada", "Bo"]);
    expect(list.querySelector("[data-ranking-entry]")).toBeNull();
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
    const board = await screen.findByRole("region", { name: /rangliste/i });
    const entries = () => Array.from(board.querySelectorAll(".ranking-podium [data-ranking-entry]"));
    // Erst der alte Stand: Bo vor Ada, Ada mit 1 Punkt.
    expect(entries()[0].querySelector(".ranking-name")?.textContent).toBe("Bo");
    expect(entries()[1].querySelector(".ranking-total")?.textContent).toBe("1");
    // Nach der Animation (<= 5 s): neue Reihenfolge und Ada mit 6 Punkten.
    await waitFor(() => {
      expect(entries()[0].querySelector(".ranking-name")?.textContent).toBe("Ada");
      expect(entries()[0].querySelector(".ranking-total")?.textContent).toBe("6");
    }, { timeout: 6000 });
  });

  // BUG-6: Die Transition wird einmal pro Auswertung animiert — nicht bei
  // jeder weiteren Snapshot-Auslieferung mit derselben resultId. Erst eine
  // neue resultId loest die Animation erneut aus.
  it("replays the transition animation only for a new resultId", async () => {
    const view = renderRole("projector");
    const previous = [
      { playerId: "player-2", name: "Bo", rank: 1, total: 3, games: [{ gameId: "sort-1", points: 3 }] },
      { playerId: "player-1", name: "Ada", rank: 2, total: 1, games: [{ gameId: "sort-1", points: 1 }] },
    ];
    const current = [
      { playerId: "player-1", name: "Ada", rank: 1, total: 6, games: [{ gameId: "sort-1", points: 1 }, { gameId: "quiz-1", points: 5 }] },
      { playerId: "player-2", name: "Bo", rank: 2, total: 3, games: [{ gameId: "sort-1", points: 3 }, { gameId: "quiz-1", points: 0 }] },
    ];
    const transition = { resultId: "result-1", gameId: "quiz-1", previous, current };
    await deliver(view, snapshot("projector", { ranking: current, rankingTransition: transition }));
    const table = await screen.findByRole("region", { name: /rangliste/i });
    await waitFor(() => expect(table.dataset.rankingStage).toBe("after"), { timeout: 6000 });

    // Dieselbe Transition nochmals ausgeliefert (z. B. Host-Aktion, die einen
    // neuen Snapshot sendet): keine erneute Animation.
    await deliver(view, snapshot("projector", { revision: 2, ranking: current, rankingTransition: { ...transition } }));
    await new Promise(resolve => setTimeout(resolve, 500));
    expect(table.dataset.rankingStage).toBe("after");

    // Neue resultId (naechste Auswertung): Animation startet wieder.
    await deliver(view, snapshot("projector", { revision: 3, ranking: current, rankingTransition: { ...transition, resultId: "result-2" } }));
    await waitFor(() => expect(table.dataset.rankingStage).not.toBe("after"));
  });
});
