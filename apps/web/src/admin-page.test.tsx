import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminPage } from "./routes/AdminPage";

const catalogGames = [
  { id: "game-quiz", kind: "quiz", title: "Allgemeinwissen", rules: "Regeln." },
  { id: "game-sort", kind: "sorting", title: "Planeten", rules: "Regeln." },
];

const estimationDraft = JSON.stringify({
  kind: "estimation", title: "Eiffelturm", rules: "Schätzen.", question: "Höhe?", target: 330,
});

function makeResponse(body: unknown, status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function stubFetch(handler?: (url: string, init?: RequestInit) => Response) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (handler) return handler(url, init);
    if (init?.method === "DELETE") return makeResponse(null, 204);
    if (init?.method === "POST") return makeResponse({ game: { id: "new-id", kind: "estimation", title: "Eiffelturm", rules: "Schätzen." } }, 201);
    return makeResponse({ games: catalogGames }, 200);
  }));
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AdminPage", () => {
  it("lists the catalog games from GET /api/games", async () => {
    stubFetch();
    render(<AdminPage />);
    expect(await screen.findByText("Allgemeinwissen")).toBeTruthy();
    expect(screen.getByText("Planeten")).toBeTruthy();
    expect(screen.getByText(/game-quiz/)).toBeTruthy();
  });

  it("uploads a draft with the bearer token and refreshes the list", async () => {
    const calls = stubFetch();
    render(<AdminPage />);
    await screen.findByText("Allgemeinwissen");

    fireEvent.change(screen.getByLabelText(/admin-token/i), { target: { value: "secret" } });
    fireEvent.change(screen.getByLabelText(/spiel-json/i), { target: { value: estimationDraft } });
    fireEvent.click(screen.getByRole("button", { name: /hochladen/i }));

    await waitFor(() => expect(calls.some(call =>
      call.url === "/api/games" && call.init?.method === "POST"
      && (call.init.headers as Record<string, string>).Authorization === "Bearer secret")).toBe(true));
    expect(await screen.findByRole("status")).toBeTruthy();
  });

  it("rejects invalid JSON locally without calling the server", async () => {
    const calls = stubFetch();
    render(<AdminPage />);
    await screen.findByText("Allgemeinwissen");

    fireEvent.change(screen.getByLabelText(/admin-token/i), { target: { value: "secret" } });
    fireEvent.change(screen.getByLabelText(/spiel-json/i), { target: { value: "{kaputt" } });
    fireEvent.click(screen.getByRole("button", { name: /hochladen/i }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(calls.filter(call => call.init?.method === "POST")).toHaveLength(0);
  });

  it("shows an error when the server rejects the token", async () => {
    stubFetch((_url, init) => {
      if (init?.method === "POST" || init?.method === "DELETE") return makeResponse({ code: "UNAUTHORIZED" }, 401);
      return makeResponse({ games: catalogGames }, 200);
    });
    render(<AdminPage />);
    await screen.findByText("Allgemeinwissen");

    fireEvent.change(screen.getByLabelText(/admin-token/i), { target: { value: "wrong" } });
    fireEvent.change(screen.getByLabelText(/spiel-json/i), { target: { value: estimationDraft } });
    fireEvent.click(screen.getByRole("button", { name: /hochladen/i }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toMatch(/token/i);
  });

  it("deletes a game with the bearer token", async () => {
    const calls = stubFetch();
    render(<AdminPage />);
    await screen.findByText("Allgemeinwissen");

    fireEvent.change(screen.getByLabelText(/admin-token/i), { target: { value: "secret" } });
    fireEvent.click(screen.getAllByRole("button", { name: /löschen|loeschen/i })[0]!);

    await waitFor(() => expect(calls.some(call =>
      call.url === "/api/games/game-quiz" && call.init?.method === "DELETE"
      && (call.init.headers as Record<string, string>).Authorization === "Bearer secret")).toBe(true));
  });
});
