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
    ...(role === "host" ? { canStartLobby: false, links: { player: `/lobbies/${lobbyId}/join`, projector: `/lobbies/${lobbyId}/projector#sessionId=projector-session&token=${"x".repeat(43)}` } } : {}),
    ...(role === "projector" ? { playerLink: `/lobbies/${lobbyId}/join` } : {}),
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
  vi.restoreAllMocks();
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

  it("keeps a successful server join successful when local session storage is unavailable", async () => {
    const fetchMock = vi.fn(async () => response({ version: 1, session: playerSession }));
    vi.stubGlobal("fetch", fetchMock);
    const originalSetItem = Storage.prototype.setItem.bind(localStorage);
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation((key, value) => {
      if (key === `lobby:${lobbyId}:player`) throw new DOMException("Storage disabled", "QuotaExceededError");
      originalSetItem(key, value);
    });

    renderAt(`/lobbies/${lobbyId}/join`);
    fireEvent.change(screen.getByRole("textbox", { name: /name/i }), { target: { value: "Ada" } });
    fireEvent.click(screen.getByRole("button", { name: /beitreten/i }));

    await waitFor(() => expect(screen.queryByRole("textbox", { name: /name/i })).toBeNull());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(`/api/lobbies/${lobbyId}/players`, expect.objectContaining({ method: "POST" }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(/du bist der lobby beigetreten/i)).toBeNull();
    expect(setItem).toHaveBeenCalledWith(`lobby:${lobbyId}:player`, JSON.stringify(playerSession));
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

  it("reopens an existing player session from the join link without creating a second player", async () => {
    localStorage.setItem(`lobby:${lobbyId}:player`, JSON.stringify(playerSession));
    const fetchMock = vi.mocked(fetch);

    const first = renderAt(`/lobbies/${lobbyId}/join`);
    await waitFor(() => expect(FakeWebSocket.instances.length).toBeGreaterThan(0));
    const firstSocket = FakeWebSocket.instances.at(-1)!;
    await waitFor(() => expect(firstSocket.sent.some(message => {
      const parsed = JSON.parse(message);
      return parsed.type === "auth" && parsed.lobbyId === lobbyId && parsed.sessionId === playerSession.sessionId && parsed.token === playerSession.token;
    })).toBe(true));
    await act(async () => firstSocket.deliver(snapshot("player")));
    expect(await screen.findByText(/warte auf die n[äa]chste spielauswahl/i)).toBeTruthy();
    expect(screen.queryByText(/spielphase/i)).toBeNull();
    first.unmount();

    renderAt(`/lobbies/${lobbyId}/join`);
    await waitFor(() => expect(FakeWebSocket.instances.length).toBeGreaterThan(1));
    const reopenedSocket = FakeWebSocket.instances.at(-1)!;
    await waitFor(() => expect(reopenedSocket.sent.some(message => {
      const parsed = JSON.parse(message);
      return parsed.type === "auth" && parsed.lobbyId === lobbyId && parsed.sessionId === playerSession.sessionId && parsed.token === playerSession.token;
    })).toBe(true));
    expect(fetchMock).not.toHaveBeenCalledWith(`/api/lobbies/${lobbyId}/players`, expect.anything());
    expect(screen.queryByRole("button", { name: /beitreten/i })).toBeNull();
  });

  it("shows a clear stale-session message after a server restart without exposing the token or rejoining", async () => {
    localStorage.setItem(`lobby:${lobbyId}:player`, JSON.stringify(playerSession));
    const fetchMock = vi.mocked(fetch);
    const router = createMemoryRouter(appRoutes, { initialEntries: [`/lobbies/${lobbyId}/join`] });
    render(<RouterProvider router={router} />);

    await waitFor(() => expect(FakeWebSocket.instances.length).toBeGreaterThan(0));
    const socket = FakeWebSocket.instances.at(-1)!;
    await waitFor(() => expect(socket.sent.some(message => {
      const parsed = JSON.parse(message);
      return parsed.type === "auth" && parsed.sessionId === playerSession.sessionId && parsed.token === playerSession.token;
    })).toBe(true));
    await act(async () => socket.deliver({
      version: 1,
      type: "error",
      requestId: null,
      code: "LOBBY_NOT_FOUND",
      message: "Lobby not found",
    }));

    const status = await screen.findByRole("status");
    expect(status.textContent).toMatch(/Lobby|Sitzung/i);
    expect(status.textContent).toMatch(/nicht mehr|abgelaufen|neu erstellen|erneut/i);
    expect(status.textContent).not.toContain(playerSession.token);
    expect(fetchMock).not.toHaveBeenCalledWith(`/api/lobbies/${lobbyId}/players`, expect.anything());
    expect(localStorage.getItem(`lobby:${lobbyId}:player`)).toBeNull();
    expect(await screen.findByRole("button", { name: /beitreten/i })).toBeTruthy();

    const nextLobbyId = "lobby-456";
    await act(async () => router.navigate(`/lobbies/${nextLobbyId}/join`));
    await waitFor(() => expect(screen.getByRole("button", { name: /beitreten/i })).toBeTruthy());
    expect(FakeWebSocket.instances.flatMap(instance => instance.sent).some(message => {
      const parsed = JSON.parse(message);
      return parsed.type === "auth" && parsed.lobbyId === nextLobbyId && parsed.token === playerSession.token;
    })).toBe(false);
    expect(fetchMock).not.toHaveBeenCalledWith(`/api/lobbies/${nextLobbyId}/players`, expect.anything());
  });

  it("restores a projector session from local storage after reopening its route", async () => {
    localStorage.setItem(`lobby:${lobbyId}:projector`, JSON.stringify(projectorSession));
    const first = renderAt(`/lobbies/${lobbyId}/projector`);
    await waitFor(() => expect(FakeWebSocket.instances.length).toBeGreaterThan(0));
    first.unmount();

    renderAt(`/lobbies/${lobbyId}/projector`);
    await waitFor(() => expect(FakeWebSocket.instances.length).toBeGreaterThan(1));
    const reopenedSocket = FakeWebSocket.instances.at(-1)!;
    await waitFor(() => expect(reopenedSocket.sent.some(message => {
      const parsed = JSON.parse(message);
      return parsed.type === "auth" && parsed.lobbyId === lobbyId && parsed.sessionId === projectorSession.sessionId && parsed.token === projectorSession.token;
    })).toBe(true));
  });

  it.each([
    [`/lobbies/${lobbyId}/host#sessionId=${hostSession.sessionId}&token=${hostSession.token}`, "host"],
    [`/lobbies/${lobbyId}/projector#sessionId=${projectorSession.sessionId}&token=${projectorSession.token}`, "projector"],
  ] as const)("shows the live participant list and unnamed-player placeholder for the %s route", async (path, role) => {
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

describe("CHG-1 shell and player base", () => {
  it("renders no site header or main navigation on any route", () => {
    localStorage.setItem(`lobby:${lobbyId}:player`, JSON.stringify(playerSession));
    renderAt(`/lobbies/${lobbyId}/join`);
    expect(document.querySelector("header")).toBeNull();
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.queryByRole("link", { name: /beitreten/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /projektor/i })).toBeNull();
  });

  it("shows players no phase text, no join confirmation, no participant list and no status card", async () => {
    localStorage.setItem(`lobby:${lobbyId}:player`, JSON.stringify(playerSession));
    renderAt(`/lobbies/${lobbyId}/join`);
    await waitFor(() => expect(FakeWebSocket.instances.length).toBeGreaterThan(0));
    const socket = FakeWebSocket.instances.at(-1)!;
    await act(async () => socket.deliver(snapshot("player")));
    expect(await screen.findByText(/warte auf die n[äa]chste spielauswahl/i)).toBeTruthy();
    expect(screen.queryByText(/spielphase/i)).toBeNull();
    expect(screen.queryByText(/du bist der lobby beigetreten/i)).toBeNull();
    expect(screen.queryByRole("region", { name: /teilnehmer/i })).toBeNull();
    expect(screen.queryByRole("region", { name: /dein spielstand/i })).toBeNull();
    expect(screen.queryByText("Spieler 1")).toBeNull();
  });

  it("keeps connection errors visible on the player route", async () => {
    renderAt(`/lobbies/${lobbyId}/player`);
    expect(await screen.findByText(/sitzung fehlt/i)).toBeTruthy();
  });
});
