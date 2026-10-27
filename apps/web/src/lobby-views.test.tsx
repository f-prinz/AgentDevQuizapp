import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appRoutes } from "./app-routes";

const lobbyId = "lobby-123";
const hostSession = { lobbyId, sessionId: "host-session", role: "host", token: "h".repeat(43) };
const playerSession = { lobbyId, sessionId: "player-session", role: "player", token: "p".repeat(43) };
const projectorSession = { lobbyId, sessionId: "projector-session", role: "projector", token: "x".repeat(43) };

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  static readonly OPEN = 1;
  readyState = FakeWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onclose: (() => void) | null = null;
  readonly sent: string[] = [];
  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
    queueMicrotask(() => this.onopen?.());
  }
  send(value: string) { this.sent.push(value); }
  close() { this.readyState = 3; this.onclose?.(); }
  deliver(value: unknown) { this.onmessage?.({ data: JSON.stringify(value) } as MessageEvent<string>); }
}

function snapshot(role: "host" | "player" | "projector") {
  return {
    version: 1,
    type: "snapshot",
    lobbyId,
    revision: 1,
    serverTime: Date.now(),
    phase: "lobby",
    participants: [{ id: "player-1", name: "Spieler 1", number: 1, connected: true, waiting: false }],
    catalog: [],
    selectedGameId: null,
    ranking: [],
    rankingTransition: null,
    role,
    ...(role === "host" ? { canStartLobby: false } : {}),
    ...(role === "player" ? { playerId: "player-1", input: { answer: null, final: false, participating: true } } : {}),
    round: null,
  };
}

function renderAt(path: string) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  return render(<RouterProvider router={router} />);
}

function response(body: unknown, status = 201) {
  return Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body } as Response);
}

beforeEach(() => {
  FakeWebSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeWebSocket);
  vi.stubGlobal("fetch", vi.fn(async () => response({
    version: 1,
    lobbyId,
    host: hostSession,
    projector: projectorSession,
    links: {
      host: `/lobbies/${lobbyId}/host#sessionId=${hostSession.sessionId}&token=${hostSession.token}`,
      player: `/lobbies/${lobbyId}/join`,
      projector: `/lobbies/${lobbyId}/projector#sessionId=${projectorSession.sessionId}&token=${projectorSession.token}`,
    },
  })));
});

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("FEAT-2 lobby views", () => {
  it("creates a lobby through the REST proxy and displays all three server-provided scoped links", async () => {
    renderAt("/");
    fireEvent.click(screen.getByRole("button", { name: /lobby erstellen/i }));

    const fetchMock = vi.mocked(fetch);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/lobbies", expect.objectContaining({ method: "POST" })));
    expect((await screen.findByRole("link", { name: /host-link/i })).getAttribute("href")).toBe(`/lobbies/${lobbyId}/host#sessionId=${hostSession.sessionId}&token=${hostSession.token}`);
    expect(screen.getByRole("link", { name: /spieler-link/i }).getAttribute("href")).toBe(`/lobbies/${lobbyId}/join`);
    expect(screen.getByRole("link", { name: /projektor-link/i }).getAttribute("href")).toBe(`/lobbies/${lobbyId}/projector#sessionId=${projectorSession.sessionId}&token=${projectorSession.token}`);
    expect(screen.getByRole("link", { name: /host-link/i }).getAttribute("href")).toContain("#sessionId=");
  });

  it("limits a player name to 20 characters, joins the lobby via REST, and stores the returned player session", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === `/api/lobbies/${lobbyId}/players`) {
        return response({ version: 1, session: playerSession });
      }
      return response({});
    }));
    renderAt(`/lobbies/${lobbyId}/join`);

    const name = screen.getByRole("textbox", { name: /name/i });
    expect(name.getAttribute("maxLength")).toBe("20");
    fireEvent.change(name, { target: { value: "ABCDEFGHIJKLMNOPQRST" } });
    fireEvent.click(screen.getByRole("button", { name: /beitreten/i }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith(`/api/lobbies/${lobbyId}/players`, expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ "Content-Type": "application/json" }),
      body: JSON.stringify({ name: "ABCDEFGHIJKLMNOPQRST" }),
    })));
    await waitFor(() => expect(localStorage.length).toBeGreaterThan(0));
    expect(Array.from({ length: localStorage.length }, (_, index) => localStorage.getItem(localStorage.key(index) ?? "") ?? "").join(" ")).toContain(playerSession.token);
  });

  it("authenticates the host from the link fragment and restores the session after a fresh route load", async () => {
    const link = `/lobbies/${lobbyId}/host#sessionId=${hostSession.sessionId}&token=${hostSession.token}`;
    const first = renderAt(link);
    await waitFor(() => expect(FakeWebSocket.instances.length).toBeGreaterThan(0));
    const firstSocket = FakeWebSocket.instances.at(-1)!;
    await waitFor(() => expect(firstSocket.sent.some(message => {
      const parsed = JSON.parse(message);
      return parsed.type === "auth" && parsed.sessionId === hostSession.sessionId && parsed.token === hostSession.token;
    })).toBe(true));
    first.unmount();

    renderAt(`/lobbies/${lobbyId}/host`);
    await waitFor(() => expect(FakeWebSocket.instances.length).toBeGreaterThan(1));
    const refreshedSocket = FakeWebSocket.instances.at(-1)!;
    await waitFor(() => expect(refreshedSocket.sent.some(message => {
      const parsed = JSON.parse(message);
      return parsed.type === "auth" && parsed.sessionId === hostSession.sessionId && parsed.token === hostSession.token;
    })).toBe(true));
  });

  it.each([
    [`/lobbies/${lobbyId}/host#sessionId=${hostSession.sessionId}&token=${hostSession.token}`, "host"],
    [`/lobbies/${lobbyId}/join`, "player"],
    [`/lobbies/${lobbyId}/projector#sessionId=${projectorSession.sessionId}&token=${projectorSession.token}`, "projector"],
  ] as const)("shows the live participant list and unnamed-player placeholder for the %s route", async (path, role) => {
    if (role === "player") {
      localStorage.setItem(`lobby:${lobbyId}:player`, JSON.stringify(playerSession));
    }
    if (role === "projector") {
      localStorage.setItem(`lobby:${lobbyId}:projector`, JSON.stringify(projectorSession));
    }
    renderAt(path);
    await waitFor(() => expect(FakeWebSocket.instances.length).toBeGreaterThan(0));
    const socket = FakeWebSocket.instances.at(-1)!;
    await act(async () => socket.deliver(snapshot(role)));
    expect(await screen.findByText("Spieler 1")).toBeTruthy();
    expect(screen.getByRole("region", { name: /teilnehmer/i })).toBeTruthy();
  });
});
