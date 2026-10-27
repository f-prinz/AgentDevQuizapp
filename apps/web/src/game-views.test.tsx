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
  if (role === "host") {
    data.canStartLobby = true;
    data.links = { player: `/lobbies/${lobbyId}/join`, projector: `/lobbies/${lobbyId}/projector#sessionId=p&token=${token}` };
  }
  if (role === "projector") data.playerLink = `/lobbies/${lobbyId}/join`;
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
      if (phase === "playing" && role === "projector") expect(await screen.findByText(/Welche Stadt ist die Hauptstadt von Frankreich\?/)).toBeTruthy();
      if (phase === "playing" && role !== "projector") expect(screen.queryByText(/Welche Stadt ist die Hauptstadt von Frankreich\?/)).toBeNull();
      if (phase === "evaluation" && role !== "host") expect(await screen.findByText(/Paris/)).toBeTruthy();
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
    fireEvent.click(await screen.findByRole("button", { name: "Lyon" }));
    await waitFor(() => expect(view.socket().commands().some(command => command.type === "answer.set" && (command.answer as { optionId?: string }).optionId === "b")).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: /abgeben/i }));
    await waitFor(() => expect(view.socket().commands().some(command => command.type === "answer.submit" && (command.answer as { optionId?: string }).optionId === "b")).toBe(true));
    await deliver(view, snapshot("player", "playing", { revision: 2, input: { answer: { kind: "quiz", optionId: "b" }, final: true, participating: true } }));
    expect((screen.getByRole("button", { name: "Paris" })).matches(":disabled")).toBe(true);
  });

  it("shows waiting participants as unable to answer", async () => {
    const view = renderRole("player");
    await deliver(view, snapshot("player", "playing", { input: { answer: null, final: false, participating: false }, playerId: "player-3" }));
    expect(await screen.findByText(/nächsten spielauswahl|naechsten spielauswahl|keine antwort m/i)).toBeTruthy();
    expect((screen.getByRole("button", { name: /abgeben/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps the reveal control reachable when input is closed without status texts", async () => {
    const view = renderRole("host");
    await deliver(view, snapshot("host", "playing", {
      round: { timer: { ...rounds.playing.timer, inputClosed: true, canReveal: true } },
    }));
    const phase = screen.getByRole("region", { name: /spielphase/i });
    expect(phase.textContent).not.toMatch(/eingabezeit|antwortphase|entgegengenommen|alle antworten sind eingegangen/i);
    expect((phase.querySelector("button") as HTMLButtonElement).disabled).toBe(false);
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
    expect((await screen.findByRole("button", { name: "Marseille" })).closest("[data-answer-state]")?.getAttribute("data-answer-state")).toBe("selected");
    await act(async () => view.socket().deliver(snapshot("player", "playing", { revision: 2, input: { answer: { kind: "quiz", optionId: "c" }, final: true, participating: true }, round: { ...rounds.playing, timer: { ...rounds.playing.timer, serverTime: 10_000, deadline: 20_000, acceptUntil: 22_000 } } })));
    expect((screen.getByRole("button", { name: "Marseille" })).closest("[data-answer-state]")?.getAttribute("data-answer-state")).toBe("selected");
    expect((screen.getByRole("button", { name: "Paris" })).matches(":disabled")).toBe(true);
    expect(screen.getByRole("timer").textContent).toMatch(/10/);
  });

  it("never exposes options before evaluation on projector and reveals solution only in evaluation", async () => {
    const view = renderRole("projector");
    await deliver(view, snapshot("projector", "playing"));
    expect(screen.queryByText("Paris")).toBeNull();
    expect(screen.queryByText("Lyon")).toBeNull();
    await deliver(view, snapshot("projector", "evaluation", { revision: 2 }));
    const display = await screen.findByRole("region", { name: /spielanzeige/i });
    await waitFor(() => {
      const correct = display.querySelector('[data-answer-state="correct"]');
      expect(correct?.textContent).toContain("Paris");
      expect(correct?.textContent).toMatch(/richtig/i);
    });
  });
});

describe("CHG-1 phase texts and status card", () => {
  it("shows no phase labels or input-status texts on host and player views", async () => {
    const host = renderRole("host");
    await deliver(host, snapshot("host", "playing"));
    expect(screen.queryByText(/antworten werden entgegengenommen|eingabezeit ist beendet/i)).toBeNull();
    expect(screen.queryByText(/^(startphase|spielphase|auswertung)$/i)).toBeNull();
    host.unmount();

    const player = renderRole("player");
    await deliver(player, snapshot("player", "playing", {
      input: { answer: { kind: "quiz", optionId: "b" }, final: true, participating: true },
    }));
    await screen.findByRole("timer");
    expect(screen.queryByText(/deine antwort ist final abgegeben/i)).toBeNull();
    expect(screen.queryByText(/eingabezeit ist beendet/i)).toBeNull();
    expect(screen.queryByRole("region", { name: /dein spielstand/i })).toBeNull();
  });
});

describe("player answer feedback", () => {

  it("labels quiz answers as neutral before evaluation and correct or wrong with text in evaluation", async () => {
    const view = renderRole("player");
    await deliver(view, snapshot("player", "playing", {
      input: { answer: { kind: "quiz", optionId: "b" }, final: true, participating: true },
    }));
    expect(screen.getByText("Lyon").closest("[data-answer-state]")?.getAttribute("data-answer-state")).toBe("selected");
    expect(screen.queryByText(/richtig|falsch/i)).toBeNull();

    await deliver(view, snapshot("player", "evaluation", {
      revision: 2,
      round: { ownEvaluation: { answer: { kind: "quiz", optionId: "b" }, points: 0, distance: null, positionsCorrect: null } },
    }));
    const wrong = screen.getByText("Lyon").closest("[data-answer-state]");
    const correct = screen.getByText("Paris").closest("[data-answer-state]");
    expect(wrong?.getAttribute("data-answer-state")).toBe("wrong");
    expect(wrong?.textContent).toMatch(/falsch/i);
    expect(wrong?.className).toMatch(/answer-wrong/);
    expect(correct?.getAttribute("data-answer-state")).toBe("correct");
    expect(correct?.textContent).toMatch(/richtig/i);
    expect(correct?.className).toMatch(/answer-correct/);
  });

  it("shows the authoritative correct quiz option when the player timed out without an answer", async () => {
    const view = renderRole("player");
    await deliver(view, snapshot("player", "evaluation", {
      round: { ownEvaluation: { answer: null, points: 0, distance: null, positionsCorrect: null } },
    }));
    const correct = screen.getByText("Paris").closest("[data-answer-state]");
    expect(correct?.getAttribute("data-answer-state")).toBe("correct");
    expect(correct?.className).toMatch(/answer-correct/);
    expect(correct?.textContent).toMatch(/richtig/i);
    expect(screen.queryByText(/deine antwort/i)).toBeNull();
    expect(document.querySelector('[data-answer-state="wrong"]')).toBeNull();
    expect(screen.queryByText(/falsch/i)).toBeNull();
  });

  it("marks sorting positions according to the player's own evaluation", async () => {
    const view = renderRole("player");
    await deliver(view, snapshot("player", "evaluation", {
      round: {
        solution: { kind: "sorting", question: "Ordne die Jahre", terms: [{ id: "a", text: "1990", value: 1990 }, { id: "b", text: "2000", value: 2000 }] },
        ownEvaluation: { answer: { kind: "sorting", termIds: ["a", "b"] }, points: 1, distance: null, positionsCorrect: [true, false] },
      },
    }));
    const ownAnswers = screen.getByRole("list", { name: /deine antwort/i });
    expect(ownAnswers.querySelector('[data-answer-state="correct"]')?.textContent).toContain("1990");
    expect(ownAnswers.querySelector('[data-answer-state="wrong"]')?.textContent).toContain("2000");
    expect(ownAnswers.querySelector('[data-answer-state="wrong"]')?.textContent).toMatch(/falsch/i);
  });

  it("does not show private player status or answer feedback on the projector", async () => {
    const view = renderRole("projector");
    await deliver(view, snapshot("projector", "evaluation", {
      ranking: [{ playerId: "player-1", name: "Ada", rank: 1, total: 9, games: [{ gameId: "quiz-1", points: 4 }] }],
      round: { results: [{ playerId: "player-1", name: "Ada", points: 4, rank: 1, distance: null, errors: null }] },
    }));
    expect(screen.queryByRole("region", { name: /dein spielstand/i })).toBeNull();
    expect(screen.queryByText(/deine abgegebene antwort/i)).toBeNull();
    expect(screen.queryByText(/answer-(correct|wrong)/i)).toBeNull();
  });
});

describe("CHG-3 game phase views", () => {
  it("shows the host only timer and resolve control while playing", async () => {
    const view = renderRole("host");
    await deliver(view, snapshot("host", "playing"));
    expect(screen.queryByText(/Welche Stadt/)).toBeNull();
    expect(screen.queryByText("Paris")).toBeNull();
    expect(screen.getByRole("timer")).toBeTruthy();
    expect(screen.getByRole("button", { name: /auflösen|aufloesen/i })).toBeTruthy();
  });

  it("shows the host only the next-step control after evaluation", async () => {
    const view = renderRole("host");
    await deliver(view, snapshot("host", "evaluation"));
    expect(screen.queryByText("Auflösung")).toBeNull();
    expect(screen.queryByText("Ergebnisse")).toBeNull();
    expect(screen.getByRole("button", { name: /nächste frage|naechste frage/i })).toBeTruthy();
  });

  it("keeps the ranking on the right of the projector during play without participant status", async () => {
    const view = renderRole("projector");
    await deliver(view, snapshot("projector", "playing", {
      ranking: [{ playerId: "player-1", name: "Ada", rank: 1, total: 5, games: [{ gameId: "quiz-1", points: 5 }] }],
    }));
    const ranking = await screen.findByRole("region", { name: /rangliste/i });
    expect(ranking.textContent).toContain("Ada");
    expect(ranking.textContent).toContain("5");
    const headers = Array.from(ranking.querySelectorAll("th")).map(cell => cell.textContent);
    expect(headers).toEqual(["Platz", "Punkte", "Spielername"]);
    expect(screen.queryByRole("region", { name: /teilnehmerstatus/i })).toBeNull();
    expect(screen.queryByText(/verbunden|getrennt/i)).toBeNull();
    expect(await screen.findByText(/Welche Stadt/)).toBeTruthy();
  });

  it("shows players only options and timer without the question text", async () => {
    const view = renderRole("player");
    await deliver(view, snapshot("player", "playing"));
    expect(screen.getByRole("timer")).toBeTruthy();
    expect(screen.queryByText(/Welche Stadt/)).toBeNull();
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
    for (const option of ["Paris", "Lyon", "Marseille", "Toulouse"]) {
      expect(screen.getByRole("button", { name: option })).toBeTruthy();
    }
  });

  it("marks the player's chosen option as selected while playing", async () => {
    const view = renderRole("player");
    await deliver(view, snapshot("player", "playing"));
    const option = await screen.findByRole("button", { name: "Lyon" });
    fireEvent.click(option);
    await waitFor(() => expect(option.closest("[data-answer-state]")?.getAttribute("data-answer-state")).toBe("selected"));
    await waitFor(() => expect(view.socket().commands().some(command =>
      command.type === "answer.set" && (command.answer as { optionId?: string }).optionId === "b")).toBe(true));
  });
});

describe("CHG-4 visual changes", () => {
  it("renders sorting terms on grey answer tiles", async () => {
    const view = renderRole("player");
    await deliver(view, snapshot("player", "playing", { round: {
      roundId: "round-2", game: { id: "sort-1", kind: "sorting", title: "Jahre ordnen", rules: "Begriffe ordnen" },
      questionIndex: 0, questionCount: 1, phase: "playing",
      task: { kind: "sorting", question: "Ordne die Jahre", terms: [
        { id: "a", text: "Mauerfall" }, { id: "b", text: "Mondlandung" }, { id: "c", text: "Internet" },
      ] },
      timer: { roundId: "round-2", serverTime: 1_000, deadline: 61_000, acceptUntil: 63_000, inputClosed: false, canReveal: false },
    } }));
    const items = screen.getAllByRole("listitem").filter(item => item.closest(".sortable-terms"));
    expect(items).toHaveLength(3);
    for (const item of items) expect(item.className).toContain("answer-tile");
  });

  it("wraps the estimation input in a grey tile", async () => {
    const view = renderRole("player");
    await deliver(view, snapshot("player", "playing", { round: {
      roundId: "round-3", game: { id: "est-1", kind: "estimation", title: "Wie viele?", rules: "Zahl schaetzen" },
      questionIndex: 0, questionCount: 1, phase: "playing",
      task: { kind: "estimation", question: "Wie hoch ist der Eiffelturm in Metern?" },
      timer: { roundId: "round-3", serverTime: 1_000, deadline: 31_000, acceptUntil: 33_000, inputClosed: false, canReveal: false },
    } }));
    const input = await screen.findByLabelText(/schätzung|schaetzung/i);
    expect(input.closest(".answer-tile")).toBeTruthy();
  });
});

describe("FEAT-10 sorting views", () => {
  const sortingPlaying = {
    roundId: "round-2", game: { id: "sort-1", kind: "sorting", title: "Jahre ordnen", rules: "Begriffe ordnen" },
    questionIndex: 0, questionCount: 1, phase: "playing",
    task: { kind: "sorting", question: "Ordne die Jahre", terms: [
      { id: "a", text: "Mauerfall" }, { id: "b", text: "Mondlandung" }, { id: "c", text: "Internet" },
    ] },
    timer: { roundId: "round-2", serverTime: 1_000, deadline: 61_000, acceptUntil: 63_000, inputClosed: false, canReveal: false },
  };
  const sortingEval = {
    roundId: "round-2", game: { id: "sort-1", kind: "sorting", title: "Jahre ordnen", rules: "Begriffe ordnen" },
    questionIndex: 0, questionCount: 1, phase: "evaluation", hasNextQuestion: false,
    solution: { kind: "sorting", question: "Ordne die Jahre", terms: [
      { id: "b", text: "Mondlandung", value: 1969 }, { id: "a", text: "Mauerfall", value: 1989 }, { id: "c", text: "Internet", value: 1991 },
    ] },
  };

  it("reorders terms via drag and drop and sends the new order", async () => {
    const view = renderRole("player");
    await deliver(view, snapshot("player", "playing", { round: sortingPlaying }));
    const items = screen.getAllByRole("listitem").filter(item => item.closest(".sortable-terms"));
    expect(items).toHaveLength(3);
    const dataTransfer = { data: new Map<string, string>(), setData(type: string, value: string) { this.data.set(type, value); }, getData(type: string) { return this.data.get(type) ?? ""; }, effectAllowed: "move", dropEffect: "move" };
    fireEvent.dragStart(items[0], { dataTransfer });
    fireEvent.dragOver(items[2], { dataTransfer });
    fireEvent.drop(items[2], { dataTransfer });
    await waitFor(() => expect(view.socket().commands().some(command =>
      command.type === "answer.set" && JSON.stringify((command.answer as { termIds?: string[] }).termIds) === JSON.stringify(["b", "c", "a"]))).toBe(true));
  });

  it("shows the solution order with values and per-player errors on the projector", async () => {
    const view = renderRole("projector");
    await deliver(view, snapshot("projector", "evaluation", {
      round: { ...sortingEval, results: [
        { playerId: "player-1", name: "Ada", points: 3, rank: 1, distance: null, errors: 0 },
        { playerId: "player-2", name: "Bo", points: 1, rank: 2, distance: null, errors: 2 },
      ] },
    }));
    const display = await screen.findByRole("region", { name: /spielanzeige/i });
    const orderedTerms = Array.from(display.querySelectorAll(".solution ol li")).map(item => item.textContent);
    expect(orderedTerms[0]).toContain("Mondlandung");
    expect(orderedTerms[0]).toContain("1969");
    expect(orderedTerms[2]).toContain("Internet");
    expect(display.textContent).toMatch(/Ada.*0\s*Fehler|Ada.*\b0\b/i);
    expect(display.textContent).toMatch(/Bo.*2\s*Fehler/i);
  });

  it("keeps the sorting terms secret from the projector during play", async () => {
    const view = renderRole("projector");
    await deliver(view, snapshot("projector", "playing", { round: { ...sortingPlaying, task: { kind: "sorting", question: "Ordne die Jahre" } } }));
    expect(screen.queryByText("Mauerfall")).toBeNull();
    expect(await screen.findByText(/Ordne die Jahre/)).toBeTruthy();
  });
});

describe("FEAT-12 estimation views", () => {
  const estimationPlaying = {
    roundId: "round-3", game: { id: "est-1", kind: "estimation", title: "Wie viele?", rules: "Zahl schaetzen" },
    questionIndex: 0, questionCount: 1, phase: "playing",
    task: { kind: "estimation", question: "Wie hoch ist der Eiffelturm in Metern?" },
    timer: { roundId: "round-3", serverTime: 1_000, deadline: 31_000, acceptUntil: 33_000, inputClosed: false, canReveal: false },
  };
  const estimationEval = {
    roundId: "round-3", game: { id: "est-1", kind: "estimation", title: "Wie viele?", rules: "Zahl schaetzen" },
    questionIndex: 0, questionCount: 1, phase: "evaluation", hasNextQuestion: false,
    solution: { kind: "estimation", question: "Wie hoch ist der Eiffelturm in Metern?", target: 330 },
  };

  it("sends a numeric estimation draft for the player", async () => {
    const view = renderRole("player");
    await deliver(view, snapshot("player", "playing", { round: estimationPlaying }));
    fireEvent.change(await screen.findByLabelText(/schätzung|schaetzung/i), { target: { value: "300" } });
    await waitFor(() => expect(view.socket().commands().some(command =>
      command.type === "answer.set" && (command.answer as { value?: number }).value === 300)).toBe(true));
  });

  it("shows the player's own estimate and distance to the solution", async () => {
    const view = renderRole("player");
    await deliver(view, snapshot("player", "evaluation", {
      round: { ...estimationEval, ownEvaluation: { answer: { kind: "estimation", value: 300 }, points: 3, distance: 30, positionsCorrect: null } },
    }));
    const section = await screen.findByRole("region", { name: /spielphase/i });
    expect(section.textContent).toContain("330");
    expect(section.textContent).toMatch(/300/);
    expect(section.textContent).toMatch(/abstand/i);
    expect(section.textContent).toContain("Abstand zur Lösung: 30");
  });

  it("lists players by rank with distance on the projector", async () => {
    const view = renderRole("projector");
    await deliver(view, snapshot("projector", "evaluation", {
      round: { ...estimationEval, results: [
        { playerId: "player-1", name: "Ada", points: 3, rank: 1, distance: 5, errors: null },
        { playerId: "player-2", name: "Bo", points: 1, rank: 2, distance: 42, errors: null },
      ] },
    }));
    const display = await screen.findByRole("region", { name: /spielanzeige/i });
    expect(display.textContent).toContain("330");
    const resultRows = display.querySelectorAll("ol li");
    expect(resultRows[0].textContent).toContain("Ada");
    expect(resultRows[0].textContent).toMatch(/platz\s*1/i);
    expect(resultRows[0].textContent).toMatch(/abstand\s*5/i);
    expect(resultRows[1].textContent).toContain("Bo");
    expect(resultRows[1].textContent).toMatch(/abstand\s*42/i);
  });
});

describe("FEAT-8 quiz views", () => {
  it("renders the four answer options as selectable buttons for the player", async () => {
    const view = renderRole("player");
    await deliver(view, snapshot("player", "playing"));
    expect(screen.queryByRole("radio")).toBeNull();
    for (const option of ["Paris", "Lyon", "Marseille", "Toulouse"]) {
      expect(screen.getByRole("button", { name: option })).toBeTruthy();
    }
  });

  it("shows the host only timer and resolve control during play", async () => {
    const view = renderRole("host");
    await deliver(view, snapshot("host", "playing"));
    expect(screen.queryByText(/Welche Stadt ist die Hauptstadt von Frankreich\?/)).toBeNull();
    for (const option of ["Paris", "Lyon", "Marseille", "Toulouse"]) {
      expect(screen.queryByText(option)).toBeNull();
    }
    expect(screen.getByRole("timer")).toBeTruthy();
  });

  it.each(["projector"] as const)("marks the correct quiz option in the %s evaluation answer list", async role => {
    const view = renderRole(role);
    await deliver(view, snapshot(role, "evaluation"));
    const correct = screen.getByText("Paris").closest("[data-answer-state]");
    expect(correct?.getAttribute("data-answer-state")).toBe("correct");
    expect(correct?.textContent).toMatch(/richtig/i);
    expect(correct?.className).toMatch(/answer-correct/);
    expect(screen.queryByText("Lyon")?.closest("[data-answer-state]")?.getAttribute("data-answer-state")).toBe("neutral");
  });

  it("does not expose answer options on the projector during play", async () => {
    const view = renderRole("projector");
    await deliver(view, snapshot("projector", "playing"));
    for (const option of ["Paris", "Lyon", "Marseille", "Toulouse"]) {
      expect(screen.queryByText(option)).toBeNull();
    }
  });
});
