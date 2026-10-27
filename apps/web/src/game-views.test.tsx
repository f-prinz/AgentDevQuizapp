import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appRoutes } from "./app-routes";

const lobbyId = "game-lobby";
const rounds = {
  start: { roundId: "round-1", game: { id: "quiz-1", kind: "quiz", title: "Weltwissen", rules: "Eine Antwort" }, questionIndex: 0, questionCount: 2, phase: "start" },
  playing: {
    roundId: "round-1", game: { id: "quiz-1", kind: "quiz", title: "Weltwissen", rules: "Eine Antwort" }, questionIndex: 0, questionCount: 2, phase: "playing",
    task: { kind: "quiz", question: "Welche Stadt ist die Hauptstadt von Frankreich?", options: [
      { id: "a", text: "Paris" }, { id: "b", text: "Lyon" }, { id: "c", text: "Marseille" }, { id: "d", text: "Toulouse" },
    ] },
    timer: { roundId: "round-1", serverTime: 1_000, deadline: 31_000, acceptUntil: 33_000, inputClosed: false, canReveal: false },
  },
  evaluation: {
    roundId: "round-1", game: { id: "quiz-1", kind: "quiz", title: "Weltwissen", rules: "Eine Antwort" }, questionIndex: 0, questionCount: 2, phase: "evaluation",
    solution: { kind: "quiz", question: "Welche Stadt ist die Hauptstadt von Frankreich?", options: [
      { id: "a", text: "Paris" }, { id: "b", text: "Lyon" }, { id: "c", text: "Marseille" }, { id: "d", text: "Toulouse" },
    ], correctOptionId: "a" }, hasNextQuestion: true,
  },
};

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
function base(phase: "start" | "playing" | "evaluation") {
  return {
    version: 1, type: "snapshot", lobbyId, revision: 1, serverTime: 1_000, phase,
    participants: [
      { id: "player-1", name: "Ada", number: 1, connected: true, waiting: false },
      { id: "player-2", name: "Bo", number: 2, connected: true, waiting: false },
      { id: "player-3", name: "Cyd", number: 3, connected: true, waiting: true },
    ], catalog: [{ id: "quiz-1", kind: "quiz", title: "Weltwissen", rules: "Eine Antwort", played: false }],
    selectedGameId: "quiz-1", ranking: [], rankingTransition: null,
  };
}
function snapshot(role: "host" | "player" | "projector", phase: "start" | "playing" | "evaluation", overrides: Record<string, unknown> = {}) {
  const data: Record<string, unknown> = { ...base(phase), role, round: rounds[phase], ...overrides };
  if (role === "host") data.canStartLobby = true;
  if (role === "player") {
    data.playerId = "player-1";
    data.input = overrides.input ?? { answer: null, final: false, participating: true };
  }
  if (role === "projector" && phase === "playing") {
    data.round = { ...rounds.playing, task: { kind: "quiz", question: rounds.playing.task.question } };
  }
  if (role === "host" && phase === "playing") {
    data.round = { ...rounds.playing, task: { kind: "quiz", question: rounds.playing.task.question, options: rounds.playing.task.options } };
  }
  if (role === "projector" && phase === "evaluation") data.round = { ...rounds.evaluation, results: [] };
  if (role === "host" && phase === "evaluation") data.round = { ...rounds.evaluation, results: [] };
  if (role === "player" && phase === "evaluation") {
    data.round = { ...rounds.evaluation, ownEvaluation: { answer: { kind: "quiz", optionId: "b" }, points: 0, distance: null, positionsCorrect: null } };
  }
  if (overrides.round) data.round = { ...(data.round as Record<string, unknown>), ...(overrides.round as Record<string, unknown>) };
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

describe("FEAT-4 game phase views", () => {
  it.each(["host", "player", "projector"] as const)("renders start, playing, and evaluation snapshots for %s", async role => {
    const view = renderRole(role);
    for (const [index, phase] of (["start", "playing", "evaluation"] as const).entries()) {
      await deliver(view, snapshot(role, phase, { revision: index + 1 }));
      expect(await screen.findByText(/Weltwissen/)).toBeTruthy();
      if (phase === "start" && role === "player") {
        expect(await screen.findByRole("region", { name: /startanimation/i })).toBeTruthy();
      }
      if (phase === "start" && role !== "player") {
        expect(await screen.findByText(/Eine Antwort/)).toBeTruthy();
      }
      if (phase === "playing") expect(await screen.findByText(/Welche Stadt ist die Hauptstadt von Frankreich\?/)).toBeTruthy();
      if (phase === "evaluation") expect(await screen.findByText(/Paris/)).toBeTruthy();
    }
  });

  it("gates host start, reveal, next-question, and finish controls by phase and server permissions", async () => {
    const view = renderRole("host");
    await deliver(view, snapshot("host", "start"));
    const start = screen.getByRole("button", { name: /start/i }) as HTMLButtonElement;
    expect(start.disabled).toBe(false);
    fireEvent.click(start);
    await waitFor(() => expect(view.socket().commands().some(command => command.type === "game.start" && command.roundId === "round-1")).toBe(true));
    await deliver(view, snapshot("host", "playing", { revision: 2 }));
    expect((screen.getByRole("button", { name: /auflösen|aufloesen/i }) as HTMLButtonElement).disabled).toBe(true);
    await deliver(view, snapshot("host", "playing", { revision: 3, round: { ...rounds.playing, timer: { ...rounds.playing.timer, inputClosed: true, canReveal: true } } }));
    const reveal = screen.getByRole("button", { name: /auflösen|aufloesen/i }) as HTMLButtonElement;
    expect(reveal.disabled).toBe(false);
    fireEvent.click(reveal);
    await waitFor(() => expect(view.socket().commands().some(command => command.type === "game.reveal" && command.roundId === "round-1")).toBe(true));
    await deliver(view, snapshot("host", "evaluation", { revision: 4 }));
    const next = screen.getByRole("button", { name: /nächste frage|naechste frage/i }) as HTMLButtonElement;
    expect(next.disabled).toBe(false);
    fireEvent.click(next);
    await waitFor(() => expect(view.socket().commands().some(command => command.type === "game.next" && command.roundId === "round-1")).toBe(true));
    await deliver(view, snapshot("host", "evaluation", { revision: 5, round: { ...rounds.evaluation, hasNextQuestion: false }, canStartLobby: false }));
    const finish = screen.getByRole("button", { name: /quiz beenden|spiel beenden|zur übersicht|zur uebersicht/i }) as HTMLButtonElement;
    expect(finish.disabled).toBe(false);
    fireEvent.click(finish);
    await waitFor(() => expect(view.socket().commands().some(command => command.type === "game.finish" && command.roundId === "round-1")).toBe(true));
  });

  it("sends mutable quiz drafts and final submission only for an active player; locks after final", async () => {
    const view = renderRole("player");
    await deliver(view, snapshot("player", "playing"));
    fireEvent.click(await screen.findByRole("radio", { name: /Lyon/i }));
    await waitFor(() => expect(view.socket().commands().some(command => command.type === "answer.set" && (command.answer as { optionId?: string }).optionId === "b")).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: /abgeben/i }));
    await waitFor(() => expect(view.socket().commands().some(command => command.type === "answer.submit" && (command.answer as { optionId?: string }).optionId === "b")).toBe(true));
    await deliver(view, snapshot("player", "playing", { revision: 2, input: { answer: { kind: "quiz", optionId: "b" }, final: true, participating: true } }));
    expect((screen.getByRole("radio", { name: /Paris/i }) as HTMLInputElement).matches(":disabled")).toBe(true);
  });

  it("shows waiting participants as unable to answer", async () => {
    const view = renderRole("player");
    await deliver(view, snapshot("player", "playing", { input: { answer: null, final: false, participating: false }, playerId: "player-3" }));
    expect(await screen.findByText(/nächste spielauswahl|naechste spielauswahl|wartet/i)).toBeTruthy();
    expect((screen.getByRole("button", { name: /abgeben/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it.each(["host", "projector"] as const)("marks waiting participants in the %s participant list", async role => {
    const view = renderRole(role);
    await deliver(view, snapshot(role, "playing"));
    const list = screen.getByRole("region", { name: role === "host" ? /teilnehmer/i : /teilnehmerstatus/i });
    const waitingParticipant = screen.getByText("Cyd").closest("li");
    expect(waitingParticipant).not.toBeNull();
    expect(waitingParticipant!.textContent).toMatch(/wartet/i);
    expect(list.contains(waitingParticipant)).toBe(true);
  });

  it("describes closed input neutrally instead of claiming every player answered", async () => {
    const view = renderRole("host");
    await deliver(view, snapshot("host", "playing", {
      round: { timer: { ...rounds.playing.timer, inputClosed: true, canReveal: true } },
    }));
    const phase = screen.getByRole("region", { name: /spielphase/i });
    expect(phase.textContent).toMatch(/eingabezeit|antwortphase/i);
    expect(phase.textContent).not.toMatch(/alle antworten sind eingegangen/i);
  });

  it("counts down from server time and presents the projector timer more prominently than the player timer", async () => {
    const player = renderRole("player");
    await deliver(player, snapshot("player", "playing"));
    const playerTimer = await screen.findByRole("timer");
    expect(playerTimer.textContent).toMatch(/30/);
    expect(playerTimer.className).toMatch(/compact|small|player/i);
    player.unmount();

    const projector = renderRole("projector");
    await deliver(projector, snapshot("projector", "playing"));
    const projectorTimer = await screen.findByRole("timer");
    expect(projectorTimer.className).toMatch(/large|prominent|projector/i);
    await deliver(projector, snapshot("projector", "playing", { revision: 2, serverTime: 16_000, round: { timer: { ...rounds.playing.timer, serverTime: 16_000 } } }));
    await waitFor(() => expect(projectorTimer.textContent).toMatch(/15/));
  });

  it("restores draft, final state, and authoritative deadline from a reauthenticated snapshot", async () => {
    const view = renderRole("player");
    await deliver(view, snapshot("player", "playing", { input: { answer: { kind: "quiz", optionId: "c" }, final: false, participating: true } }));
    expect((await screen.findByRole("radio", { name: /Marseille/i }) as HTMLInputElement).checked).toBe(true);
    await act(async () => view.socket().deliver(snapshot("player", "playing", { revision: 2, input: { answer: { kind: "quiz", optionId: "c" }, final: true, participating: true }, round: { ...rounds.playing, timer: { ...rounds.playing.timer, serverTime: 10_000, deadline: 20_000, acceptUntil: 22_000 } } })));
    expect((screen.getByRole("radio", { name: /Marseille/i }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("radio", { name: /Paris/i }) as HTMLInputElement).matches(":disabled")).toBe(true);
    expect(screen.getByRole("timer").textContent).toMatch(/10/);
  });

  it("never exposes options before evaluation on projector and reveals solution only in evaluation", async () => {
    const view = renderRole("projector");
    await deliver(view, snapshot("projector", "playing"));
    expect(screen.queryByText("Paris")).toBeNull();
    expect(screen.queryByText("Lyon")).toBeNull();
    await deliver(view, snapshot("projector", "evaluation", { revision: 2 }));
    await waitFor(() => expect(screen.getByRole("region", { name: /spielanzeige/i }).textContent).toContain("Richtige Antwort: Paris"));
    expect(screen.getByRole("region", { name: /spielanzeige/i }).textContent).not.toContain("Lyon");
  });
});
