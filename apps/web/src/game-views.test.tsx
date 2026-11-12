import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
        // CHG-6: Spieler sehen in der Startphase weder Regeln noch die Aufgabe.
        expect(screen.queryByText(/Eine Antwort/)).toBeNull();
      }
      if (phase === "start" && role !== "player") {
        expect(await screen.findByText(/Eine Antwort/)).toBeTruthy();
      }
      if (phase === "playing" && role === "projector") expect(await screen.findByText(/Welche Stadt ist die Hauptstadt von Frankreich\?/)).toBeTruthy();
      if (phase === "playing" && role === "host") expect(screen.queryByText(/Welche Stadt ist die Hauptstadt von Frankreich\?/)).toBeNull();
      // Redesign: Spieler sehen die Frage klein ueber den Antworten.
      if (phase === "playing" && role === "player") expect(await screen.findByText(/Welche Stadt ist die Hauptstadt von Frankreich\?/)).toBeTruthy();
      if (phase === "evaluation" && role !== "host") expect(await screen.findByText(/Paris/)).toBeTruthy();
    }
  });

  it("gates host start, reveal, next-question, and finish controls by phase and server permissions", async () => {
    const view = renderRole("host");
    await deliver(view, snapshot("host", "start"));
    // CHG-20: Das LobbyAccordion bringt zusaetzlich 'Lobby starten' —
    // deshalb explizit nach dem Spielphase-Button suchen.
    const start = screen.getByRole("button", { name: /spielphase starten/i }) as HTMLButtonElement;
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
    expect(screen.getByText("Abgegeben ✓ – warte auf die anderen")).toBeTruthy();
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
    await waitFor(() => expect(document.querySelector(".projector-game")).toBeTruthy());
    const display = document.querySelector(".projector-game")!;
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

  it("labels quiz answers by colour only in evaluation, without solution box or mark texts", async () => {
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
    expect(wrong?.className).toMatch(/answer-wrong/);
    // CHG-8: Kein Marktext — Farbe reicht; Tiles enthalten nur den Optionstext.
    expect(wrong?.textContent).toBe("Lyon");
    expect(correct?.getAttribute("data-answer-state")).toBe("correct");
    expect(correct?.className).toMatch(/answer-correct/);
    expect(correct?.textContent).toBe("Paris");
    // CHG-8: Nicht gewaehlte richtige Antwort blinkt tuerkis<->grau.
    expect(correct?.className).toMatch(/answer-flash-missed/);
    // CHG-8: Kein Aufloesungs-Header und kein Fragetext in der Spieler-Evaluation.
    expect(screen.queryByText("Auflösung")).toBeNull();
    expect(screen.queryByText(/Welche Stadt ist die Hauptstadt von Frankreich\?/)).toBeNull();
    expect(document.querySelectorAll(".answer-mark")).toHaveLength(0);
  });

  it("shows the authoritative correct quiz option when the player timed out without an answer", async () => {
    const view = renderRole("player");
    await deliver(view, snapshot("player", "evaluation", {
      round: { ownEvaluation: { answer: null, points: 0, distance: null, positionsCorrect: null } },
    }));
    const correct = screen.getByText("Paris").closest("[data-answer-state]");
    expect(correct?.getAttribute("data-answer-state")).toBe("correct");
    expect(correct?.className).toMatch(/answer-correct/);
    expect(correct?.textContent).toBe("Paris");
    expect(correct?.className).toMatch(/answer-flash-missed/);
    expect(screen.queryByText(/deine antwort/i)).toBeNull();
    expect(document.querySelector('[data-answer-state="wrong"]')).toBeNull();
    expect(screen.queryByText(/falsch/i)).toBeNull();
  });

  it("flashes the correct quiz option towards red when the player selected it", async () => {
    const view = renderRole("player");
    await deliver(view, snapshot("player", "evaluation", {
      round: { ownEvaluation: { answer: { kind: "quiz", optionId: "a" }, points: 1, distance: null, positionsCorrect: null } },
    }));
    const correct = screen.getByText("Paris").closest("[data-answer-state]");
    expect(correct?.getAttribute("data-answer-state")).toBe("correct");
    expect(correct?.className).toMatch(/answer-flash-own/);
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
    expect(ownAnswers.querySelector('[data-answer-state="correct"]')?.textContent).toBe("1990");
    expect(ownAnswers.querySelector('[data-answer-state="wrong"]')?.textContent).toBe("2000");
    // CHG-8: Kein Aufloesungs-Header, kein Fragetext, keine Marktexte beim Sortieren.
    expect(screen.queryByText("Auflösung")).toBeNull();
    expect(screen.queryByText(/ordne die jahre/i)).toBeNull();
    expect(document.querySelectorAll(".answer-mark")).toHaveLength(0);
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

  it("shows the player name with points and rank as top heading", async () => {
    const view = renderRole("player");
    await deliver(view, snapshot("player", "playing", {
      ranking: [
        { playerId: "player-2", name: "Bo", rank: 1, total: 12, games: [] },
        { playerId: "player-1", name: "Ada", rank: 2, total: 9, games: [{ gameId: "quiz-1", points: 4 }] },
      ],
    }));
    // CHG-16: Icons sind aria-hidden — der zugängliche Name bleibt
    // „Ada - 2 9" (Rang vor Punkten statt „Punkte (Rang)").
    const identity = screen.getByRole("heading", { level: 2, name: /ada - 2 9/i });
    expect(identity).toBeTruthy();
    // CHG-7: Die Identitätszeile liegt ausserhalb der Card.
    expect(identity.closest(".game-view")).toBeNull();
  });

  it("shows only the player name when no ranking entry exists", async () => {
    const view = renderRole("player");
    await deliver(view, snapshot("player", "playing"));
    expect(screen.getByRole("heading", { level: 2, name: "Ada" })).toBeTruthy();
  });

  // Redesign: Waehrend der Frage gehoert die Buehne der Frage — keine Rangliste.
  it("hides the ranking on the projector while playing and shows no participant status", async () => {
    const view = renderRole("projector");
    await deliver(view, snapshot("projector", "playing", {
      ranking: [{ playerId: "player-1", name: "Ada", rank: 1, total: 5, games: [{ gameId: "quiz-1", points: 5 }] }],
    }));
    expect(await screen.findByText(/Welche Stadt/)).toBeTruthy();
    expect(screen.queryByRole("region", { name: /rangliste/i })).toBeNull();
    expect(screen.queryByText(/verbunden|getrennt/i)).toBeNull();
  });

  it("shows the submission counter on the projector while playing", async () => {
    const view = renderRole("projector");
    await deliver(view, snapshot("projector", "playing", {
      participants: [
        { id: "player-1", name: "Ada", number: 1, connected: true, waiting: false, submitted: true },
        { id: "player-2", name: "Bo", number: 2, connected: true, waiting: false, submitted: false },
        { id: "player-3", name: "Cyd", number: 3, connected: true, waiting: true, submitted: false },
      ],
    }));
    expect((await screen.findByText(/von 2 abgegeben/)).textContent).toBe("1 von 2 abgegeben");
  });

  it("marks the projector timer as urgent only in the last five seconds", async () => {
    const view = renderRole("projector");
    await deliver(view, snapshot("projector", "playing"));
    expect((await screen.findByRole("timer")).className).not.toMatch(/timer-urgent/);
    await deliver(view, snapshot("projector", "playing", { revision: 2, round: { timer: { ...rounds.playing.timer, serverTime: 27_000 } } }));
    await waitFor(() => expect(screen.getByRole("timer").className).toMatch(/timer-urgent/));
  });

  // Redesign: Frage klein ueber den Antworten, per Tippen vergroesserbar.
  it("shows players the question in a collapsed peek above the options", async () => {
    const view = renderRole("player");
    await deliver(view, snapshot("player", "playing"));
    expect(screen.getByRole("timer")).toBeTruthy();
    const peek = screen.getByRole("button", { name: /Welche Stadt/ });
    expect(peek.getAttribute("aria-expanded")).toBe("false");
    const sentBefore = view.socket().sent.length;
    fireEvent.click(peek);
    expect(peek.getAttribute("aria-expanded")).toBe("true");
    expect(peek.className).toContain("question-peek--expanded");
    fireEvent.click(peek);
    expect(peek.getAttribute("aria-expanded")).toBe("false");
    expect(view.socket().sent.length).toBe(sentBefore);
    const answers = screen.getByRole("group", { name: /antwortoptionen/i });
    expect(peek.compareDocumentPosition(answers) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    for (const option of ["Paris", "Lyon", "Marseille", "Toulouse"]) {
      expect(screen.getByRole("button", { name: option })).toBeTruthy();
    }
  });

  // Review Focus 2: Reconnect mitten in der Runde nach finaler Abgabe.
  it("shows the submitted status instead of the submit button after a final answer", async () => {
    const view = renderRole("player");
    await deliver(view, snapshot("player", "playing", {
      input: { answer: { kind: "quiz", optionId: "c" }, final: true, participating: true },
      participants: [
        { id: "player-1", name: "Ada", number: 1, connected: true, waiting: false, submitted: true },
        { id: "player-2", name: "Bo", number: 2, connected: true, waiting: false, submitted: false },
      ],
    }));
    expect(await screen.findByText("Abgegeben ✓ – warte auf die anderen")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^abgeben$/i })).toBeNull();
    expect(screen.getByText("1 von 2 abgegeben")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Marseille" }).closest("[data-answer-state]")?.getAttribute("data-answer-state")).toBe("selected");
    expect(screen.getByRole("button", { name: "Paris" }).matches(":disabled")).toBe(true);
  });

  it("tells the player that time ran out when input closed before submitting", async () => {
    const view = renderRole("player");
    await deliver(view, snapshot("player", "playing", {
      input: { answer: { kind: "quiz", optionId: "b" }, final: false, participating: true },
      round: { ...rounds.playing, timer: { ...rounds.playing.timer, inputClosed: true, canReveal: true } },
    }));
    expect((await screen.findByText("Zeit abgelaufen")).getAttribute("role")).toBe("status");
    expect(screen.queryByRole("button", { name: /^abgeben$/i })).toBeNull();
  });

  it("shows the round result as a big badge in evaluation", async () => {
    const view = renderRole("player");
    await deliver(view, snapshot("player", "evaluation", {
      round: { ...rounds.evaluation, ownEvaluation: { answer: { kind: "quiz", optionId: "a" }, points: 3, distance: null, positionsCorrect: null } },
    }));
    const badge = await screen.findByLabelText("Deine Punkte: 3");
    expect(badge.textContent).toContain("+3");
    expect(badge.className).toContain("round-result--plus");
    await deliver(view, snapshot("player", "evaluation", { revision: 2 }));
    const zero = await screen.findByLabelText("Deine Punkte: 0");
    expect(zero.className).toContain("round-result--zero");
  });

  it("never vibrates the phone", async () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, "vibrate", { configurable: true, value: vibrate });
    const view = renderRole("player");
    await deliver(view, snapshot("player", "playing"));
    await deliver(view, snapshot("player", "evaluation", { revision: 2 }));
    expect(vibrate).not.toHaveBeenCalled();
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
    const items = Array.from(document.querySelectorAll(".sortable-terms li"));
    expect(items).toHaveLength(3);
    for (const item of items) expect(item.className).toContain("answer-tile");
  });

  it("renders quiz options and evaluation answers as grey tiles", async () => {
    const view = renderRole("player");
    await deliver(view, snapshot("player", "playing"));
    const options = document.querySelectorAll(".answer-option");
    expect(options).toHaveLength(4);
    // CHG-7: Quiz-Optionen sind waehrend des Spiels grau hinterlegt.
    for (const option of options) expect(option.className).toContain("answer-tile");
    await deliver(view, snapshot("player", "evaluation", { revision: 2 }));
    const answers = document.querySelectorAll(".answer-feedback li");
    expect(answers).toHaveLength(4);
    // CHG-7: Auch neutrale Antworten der Aufloesung sind Kacheln, keine Liste.
    for (const answer of answers) expect(answer.className).toContain("answer-tile");
    expect(Array.from(answers).filter(item => item.getAttribute("data-answer-state") === "neutral")).toHaveLength(2);
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

  it("renders sortable terms wired for dnd-kit", async () => {
    const view = renderRole("player");
    await deliver(view, snapshot("player", "playing", { round: sortingPlaying }));
    const items = Array.from(document.querySelectorAll(".sortable-terms li"));
    expect(items).toHaveLength(3);
    // dnd-kit useSortable verdrahtet jedes Item (role=button + tabindex).
    for (const item of items) {
      expect(item.getAttribute("role")).toBe("button");
      expect(item.getAttribute("tabindex")).toBe("0");
      // BUG-3: Ohne touch-action:none schluckt der Browser Touch-Gesten als Scroll.
      expect((item as HTMLElement).style.touchAction).toBe("none");
    }
  });

  it("hides the game title for the sorting game on player and projector", async () => {
    const playerView = renderRole("player");
    await deliver(playerView, snapshot("player", "playing", { round: sortingPlaying }));
    expect(screen.queryByText("Jahre ordnen")).toBeNull();
    playerView.unmount();
    const projectorView = renderRole("projector");
    await deliver(projectorView, snapshot("projector", "playing", { round: { ...sortingPlaying, task: { kind: "sorting", question: "Ordne die Jahre" } } }));
    expect(screen.queryByText("Jahre ordnen")).toBeNull();
    expect(await screen.findByText(/Ordne die Jahre/)).toBeTruthy();
  });

  it("shows the solution order and a rank-sorted results table on the projector", async () => {
    const view = renderRole("projector");
    await deliver(view, snapshot("projector", "evaluation", {
      round: { ...sortingEval, results: [
        { playerId: "player-2", name: "Bo", points: 1, rank: 2, distance: null, errors: 2 },
        { playerId: "player-1", name: "Ada", points: 3, rank: 1, distance: null, errors: 0 },
      ] },
    }));
    await waitFor(() => expect(document.querySelector(".projector-game")).toBeTruthy());
    const display = document.querySelector(".projector-game")!;
    // CHG-21: Die Sortier-Aufloesung ist eine Tabelle ohne Header —
    // je Zeile Position (1..n), Text und Wert, aufsteigend nach Wert.
    const solutionTable = display.querySelector(".solution table");
    expect(solutionTable).toBeTruthy();
    expect(solutionTable!.querySelectorAll("th")).toHaveLength(0);
    const solutionRows = Array.from(solutionTable!.querySelectorAll("tbody tr"));
    expect(solutionRows).toHaveLength(3);
    expect(Array.from(solutionRows[0].querySelectorAll("td")).map(cell => cell.textContent)).toEqual(["1", "Mondlandung", "1969"]);
    expect(Array.from(solutionRows[2].querySelectorAll("td")).map(cell => cell.textContent)).toEqual(["3", "Internet", "1991"]);
    // Ergebnisse nach Platz sortiert; Spec: Projektor zeigt, welcher Spieler
    // wie viele Fehler gemacht hat -> eigene Spalte "Fehler".
    const headers = Array.from(document.querySelectorAll(".results-table th"));
    expect(headers.map(cell => cell.getAttribute("aria-label"))).toEqual(["Platzierung", "Punkte", "Spielername", "Fehler"]);
    const rows = Array.from(document.querySelectorAll(".results-table tbody tr"));
    expect(rows[0].textContent).toContain("Ada");
    expect(rows[1].textContent).toContain("Bo");
    expect(rows[1].lastElementChild?.textContent).toBe("2");
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
    // CHG-8: Keine Aufloesungs-Box ("Auflösung"/Frage/Ziel) — nur Antwort, Abstand, Punkte.
    expect(screen.queryByText("Auflösung")).toBeNull();
    expect(section.textContent).not.toContain("330");
    expect(section.textContent).toMatch(/300/);
    expect(section.textContent).toContain("Abstand zur Lösung: 30");
    expect(section.textContent).toContain("Deine Punkte: 3");
  });

  it("lists players by rank with distance on the projector", async () => {
    const view = renderRole("projector");
    await deliver(view, snapshot("projector", "evaluation", {
      round: { ...estimationEval, results: [
        { playerId: "player-2", name: "Bo", points: 1, rank: 2, distance: 42, errors: null },
        { playerId: "player-1", name: "Ada", points: 3, rank: 1, distance: 5, errors: null },
      ] },
    }));
    await waitFor(() => expect(document.querySelector(".projector-game")).toBeTruthy());
    const display = document.querySelector(".projector-game")!;
    expect(display.textContent).toContain("330");
    // CHG-13/14: Schaetz-Ergebnisse als Tabelle in eigener Layout-Spalte —
    // Platzierung, Punkte, Differenz, Spielername; sortiert (Eingang unsortiert).
    const headers = Array.from(document.querySelectorAll(".results-table th"));
    expect(headers.map(cell => cell.getAttribute("aria-label"))).toEqual(["Platzierung", "Punkte", "Differenz", "Spielername"]);
    const resultRows = document.querySelectorAll(".results-table tbody tr");
    expect(resultRows[0].textContent).toContain("Ada");
    expect(resultRows[0].textContent).toContain("5");
    expect(resultRows[1].textContent).toContain("Bo");
    expect(resultRows[1].textContent).toContain("42");
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

describe("CHG-13 projector ranking and result tables", () => {
  it("renders quiz results as a points-sorted table (Punkte, Spielername)", async () => {
    const view = renderRole("projector");
    await deliver(view, snapshot("projector", "evaluation", {
      round: { results: [
        { playerId: "player-1", name: "Ada", points: 0, rank: null, distance: null, errors: null },
        { playerId: "player-2", name: "Bo", points: 2, rank: null, distance: null, errors: null },
      ] },
    }));
    await waitFor(() => expect(document.querySelector(".results-table")).toBeTruthy());
    const table = document.querySelector(".results-table")!;
    const headers = Array.from(table.querySelectorAll("th"));
    expect(headers.map(cell => cell.getAttribute("aria-label"))).toEqual(["Punkte", "Spielername"]);
    const rows = Array.from(table.querySelectorAll("tbody tr"));
    expect(rows[0].textContent).toContain("Bo");
    expect(rows[1].textContent).toContain("Ada");
  });

  it("keeps the question in the stage slot like the rules text in every phase", async () => {
    const view = renderRole("projector");
    await deliver(view, snapshot("projector", "start"));
    const stageStart = document.querySelector(".projector-game .projector-stage")!;
    expect(stageStart.textContent).toContain("Eine Antwort");
    await deliver(view, snapshot("projector", "playing", {
      revision: 2,
      round: { task: { kind: "quiz", question: "Welche Stadt ist die Hauptstadt von Frankreich?" } },
    }));
    const stagePlaying = document.querySelector(".projector-game .projector-stage")!;
    expect(stagePlaying.textContent).toContain("Welche Stadt");
    expect(stagePlaying.querySelector(".projector-count")?.textContent).toContain("Frage 1 von 2");
  });

  // Redesign: Aufloesung = Frage + Loesung links, Ergebnisse rechts, keine Rangliste.
  it("shows question, solution and results without ranking in evaluation", async () => {
    const view = renderRole("projector");
    await deliver(view, snapshot("projector", "evaluation", {
      ranking: [{ playerId: "player-1", name: "Ada", rank: 1, total: 1, games: [{ gameId: "quiz-1", points: 1 }] }],
      round: { results: [
        { playerId: "player-1", name: "Ada", points: 1, rank: null, distance: null, errors: null },
      ] },
    }));
    await waitFor(() => expect(document.querySelector(".results-table")).toBeTruthy());
    const layout = document.querySelector(".projector-layout")!;
    const game = layout.querySelector(".projector-game")!;
    const results = layout.querySelector(".results")!;
    expect(game.contains(results)).toBe(false);
    expect(game.querySelector(".projector-stage")?.textContent).toContain("Welche Stadt");
    expect(game.querySelector(".solution")).toBeTruthy();
    expect(screen.queryByRole("region", { name: /rangliste/i })).toBeNull();
  });

  it("shows the lobby with QR code, joined names and a head count but no ranking", async () => {
    const view = renderRole("projector");
    await deliver(view, { ...snapshot("projector", "start"), phase: "lobby", round: null, ranking: [
      { playerId: "player-1", name: "Ada", rank: 1, total: 0, games: [] },
    ] });
    const lobby = await screen.findByRole("region", { name: /spielerbeitritt/i });
    expect(within(lobby).getByRole("img", { name: /qr/i })).toBeTruthy();
    expect(lobby.textContent).toContain("3 dabei");
    for (const name of ["Ada", "Bo", "Cyd"]) expect(lobby.textContent).toContain(name);
    expect(screen.queryByRole("region", { name: /rangliste/i })).toBeNull();
  });

  it("shows the ranking board on the projector overview", async () => {
    const view = renderRole("projector");
    await deliver(view, { ...snapshot("projector", "start"), phase: "overview", round: null, ranking: [
      { playerId: "player-1", name: "Ada", rank: 1, total: 3, games: [{ gameId: "quiz-1", points: 3 }] },
    ] });
    const board = await screen.findByRole("region", { name: /rangliste/i });
    expect(board.querySelector(".ranking-podium")?.textContent).toContain("Ada");
  });
});

// FEAT-19: Host-Statusliste — participants steht unterhalb der game-view als
// letztes Element, zeigt Verbindungs- (MonitorCheck/MonitorX) und waehrend
// playing Abgabe-Icons (Check/Loader) sowie einen Kick-Button mit Dialog.
describe("host participant status list", () => {
  const lobbyParticipants = [
    { id: "player-1", name: "Ada", number: 1, connected: true, waiting: false },
    { id: "player-2", name: "Bo", number: 2, connected: false, waiting: false },
  ];

  it("renders the participant section below the game view as the last element", async () => {
    const view = renderRole("host");
    await deliver(view, snapshot("host", "start", { phase: "lobby", round: null }));
    const participants = await screen.findByRole("region", { name: /teilnehmer/i });
    const main = participants.closest("main");
    expect(main).not.toBeNull();
    expect(main!.lastElementChild).toBe(participants);
    const gameView = main!.querySelector(".game-view");
    expect(gameView).not.toBeNull();
    expect(participants.compareDocumentPosition(gameView!) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });

  it("keeps the participant section visible outside the lobby phase", async () => {
    const view = renderRole("host");
    await deliver(view, snapshot("host", "playing"));
    expect(await screen.findByRole("region", { name: /teilnehmer/i })).toBeTruthy();
  });

  it("shows connection status icons for connected and disconnected players", async () => {
    const view = renderRole("host");
    await deliver(view, snapshot("host", "start", { phase: "lobby", round: null, participants: lobbyParticipants }));
    const participants = await screen.findByRole("region", { name: /teilnehmer/i });
    const rows = participants.querySelectorAll("li");
    // CHG-19: Verbunden gruen (participant-icon-ok), Getrennt rot (-bad).
    expect(rows[0]?.querySelector(".lucide-monitor-check.participant-icon-ok")).not.toBeNull();
    expect(rows[0]?.querySelector(".lucide-monitor-x")).toBeNull();
    expect(rows[1]?.querySelector(".lucide-monitor-x.participant-icon-bad")).not.toBeNull();
    expect(rows[1]?.querySelector(".lucide-monitor-check")).toBeNull();
  });

  it("shows submission icons during playing for submitted and open answers", async () => {
    const view = renderRole("host");
    await deliver(view, snapshot("host", "playing", {
      participants: [
        { id: "player-1", name: "Ada", number: 1, connected: true, waiting: false, submitted: true },
        { id: "player-2", name: "Bo", number: 2, connected: true, waiting: false, submitted: false },
      ],
    }));
    const participants = await screen.findByRole("region", { name: /teilnehmer/i });
    const rows = participants.querySelectorAll("li");
    // CHG-19: Abgegeben gruen; der offene Loader bleibt neutral (keine Farbklasse).
    expect(rows[0]?.querySelector(".lucide-check.participant-icon-ok")).not.toBeNull();
    const loader = rows[1]?.querySelector(".lucide-loader");
    expect(loader).not.toBeNull();
    expect(loader?.classList.contains("participant-icon-ok")).toBe(false);
    expect(loader?.classList.contains("participant-icon-bad")).toBe(false);
  });

  it("sends player.remove only after confirming the kick dialog", async () => {
    const view = renderRole("host");
    await deliver(view, snapshot("host", "start", { phase: "lobby", round: null, participants: lobbyParticipants }));
    const participants = await screen.findByRole("region", { name: /teilnehmer/i });
    const kick = participants.querySelector("li .participant-kick");
    expect(kick).not.toBeNull();
    fireEvent.click(kick!);
    const dialog = await screen.findByRole("dialog");
    // Abbruch sendet nichts.
    fireEvent.click(within(dialog).getByRole("button", { name: /abbrechen/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(view.socket().commands().some(m => m.type === "player.remove")).toBe(false);
    // BUG-5: player.remove braucht wie jedes Kommando version + requestId,
    // sonst lehnt der Server mit INVALID_COMMAND ab ("Anfrage konnte nicht
    // verarbeitet werden").
    fireEvent.click(kick!);
    const confirm = await screen.findByRole("dialog");
    fireEvent.click(within(confirm).getByRole("button", { name: /entfernen/i }));
    await waitFor(() => expect(view.socket().commands().some(
      m => m.type === "player.remove" && m.playerId === "player-1"
        && m.version === 1 && typeof m.requestId === "string",
    )).toBe(true));
  });
});

// CHG-20: 'Lobby: <id>' wird zum Accordion "Lobby" — default offen,
// schliessbar, mit Links + ID, auf jeder Host-Phase verfuegbar.
describe("host lobby accordion", () => {
  it("shows the lobby menu in an open accordion even outside the lobby phase", async () => {
    const view = renderRole("host");
    await deliver(view, snapshot("host", "playing"));
    const accordion = document.querySelector<HTMLDetailsElement>("details.lobby-accordion");
    expect(accordion).not.toBeNull();
    expect(accordion!.open).toBe(true);
    expect(within(accordion!).getByLabelText(/spieler-link kopieren/i)).toBeTruthy();
    expect(within(accordion!).getByLabelText(/projektor-link kopieren/i)).toBeTruthy();
    // Lobby-ID im Body (nicht die Link-URLs, die den Pfad ebenfalls enthalten).
    expect(within(accordion!).getByText(new RegExp(`Lobby-ID: ${lobbyId}`))).toBeTruthy();
  });

  it("stays a single accordion (no duplicated lobby menu) in the lobby phase", async () => {
    const view = renderRole("host");
    await deliver(view, snapshot("host", "start", { phase: "lobby", round: null }));
    const accordions = document.querySelectorAll<HTMLDetailsElement>("details.lobby-accordion");
    expect(accordions).toHaveLength(1);
    expect(within(accordions[0]!).getByRole("button", { name: /lobby starten/i })).toBeTruthy();
  });

  it("closes and reopens via the summary", async () => {
    const view = renderRole("host");
    await deliver(view, snapshot("host", "playing"));
    const accordion = document.querySelector<HTMLDetailsElement>("details.lobby-accordion")!;
    const summary = within(accordion).getByText("Lobby");
    expect(accordion.open).toBe(true);
    fireEvent.click(summary);
    // jsdom haelt den Body im DOM — das open-Attribut ist die Aussage.
    await waitFor(() => expect(accordion.open).toBe(false));
    fireEvent.click(summary);
    await waitFor(() => expect(accordion.open).toBe(true));
  });
});

// CHG-22: Quiz-Optionen mit value zeigen die Aufloesung auf dem Projektor
// als Tabelle ohne Header — Spalten Text|Wert|'Richtig'-Marker,
// Optionsreihenfolge, leere Zelle bei fehlendem value.
describe("CHG-22 quiz option values", () => {
  it("renders the projector quiz solution as a headerless table when options carry values", async () => {
    const view = renderRole("projector");
    await deliver(view, snapshot("projector", "evaluation", {
      round: { ...rounds.evaluation, results: [], solution: {
        kind: "quiz", question: "Welche Stadt ist die Hauptstadt von Frankreich?", correctOptionId: "a",
        options: [
          { id: "a", text: "Paris", value: 1 }, { id: "b", text: "Lyon" },
          { id: "c", text: "Marseille", value: 3 }, { id: "d", text: "Toulouse", value: 4 },
        ],
      } },
    }));
    const table = document.querySelector(".solution table.solution-table");
    expect(table).toBeTruthy();
    expect(table!.querySelectorAll("th")).toHaveLength(0);
    const rows = Array.from(table!.querySelectorAll("tbody tr"));
    expect(rows).toHaveLength(4);
    const cells = (row: Element) => Array.from(row.querySelectorAll("td")).map(cell => cell.textContent);
    expect(cells(rows[0])).toEqual(["Paris", "1", "Richtig"]);
    expect(cells(rows[1])).toEqual(["Lyon", "", ""]);
    expect(cells(rows[2])).toEqual(["Marseille", "3", ""]);
  });

  it("keeps the marked list when no quiz option carries a value", async () => {
    const view = renderRole("projector");
    await deliver(view, snapshot("projector", "evaluation", { round: { ...rounds.evaluation, results: [] } }));
    expect(document.querySelector(".solution table")).toBeNull();
    const options = document.querySelectorAll(".solution ul.answer-feedback li");
    expect(options).toHaveLength(4);
    expect(Array.from(options).filter(item => item.getAttribute("data-answer-state") === "correct")).toHaveLength(1);
  });
});

// FEAT-20: Begrenzter Auto-Reconnect — Socket-Close startet Retry mit
// Backoff (2s/5s/10s, max. 3), Lifecycle-Events loesen sofort aus, danach
// Fehler + Reconnect-Button; Fatal-Errors retriggern nie.
describe("FEAT-20 auto reconnect", () => {
  it("reconnects automatically after the first backoff when the socket closes", async () => {
    const view = renderRole("host");
    await deliver(view, snapshot("host", "playing"));
    expect(FakeWebSocket.instances).toHaveLength(1);
    vi.useFakeTimers();
    try {
      act(() => view.socket().close());
      await act(async () => { await vi.advanceTimersByTimeAsync(1999); });
      expect(FakeWebSocket.instances).toHaveLength(1);
      await act(async () => { await vi.advanceTimersByTimeAsync(2); });
      expect(FakeWebSocket.instances).toHaveLength(2);
    } finally { vi.useRealTimers(); }
    // Der neue Socket authentifiziert sich wieder mit der Session.
    expect(view.socket().commands().some(m => m.type === "auth")).toBe(true);
  });

  it("reconnects immediately when the page becomes visible again", async () => {
    const view = renderRole("host");
    await deliver(view, snapshot("host", "playing"));
    vi.useFakeTimers();
    try {
      act(() => view.socket().close());
      // Mobile-Fall: Entsperren prueft sofort statt auf den Backoff zu warten.
      act(() => { document.dispatchEvent(new Event("visibilitychange")); });
      await act(async () => { await Promise.resolve(); });
      expect(FakeWebSocket.instances).toHaveLength(2);
    } finally { vi.useRealTimers(); }
  });

  it("stops after 3 retries, shows the error and a reconnect button", async () => {
    const view = renderRole("host");
    await deliver(view, snapshot("host", "playing"));
    vi.useFakeTimers();
    try {
      const drop = async (ms: number) => {
        act(() => view.socket().close());
        await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
      };
      await drop(2100);   // Retry 1 -> Socket 2
      await drop(5100);   // Retry 2 -> Socket 3
      await drop(10100);  // Retry 3 -> Socket 4
      expect(FakeWebSocket.instances).toHaveLength(4);
      await drop(15000);  // 4. Abbruch -> Budget erschoepft, kein neuer Socket
      expect(FakeWebSocket.instances).toHaveLength(4);
      const retry = screen.getByRole("button", { name: /erneut verbinden|neu verbinden/i });
      expect(screen.getByText(/verbindung.*verloren|nicht.*hergestellt|unterbrochen/i)).toBeTruthy();
      act(() => fireEvent.click(retry));
      await act(async () => { await Promise.resolve(); });
      expect(FakeWebSocket.instances).toHaveLength(5);
    } finally { vi.useRealTimers(); }
  });

  it("never retries after a fatal session error", async () => {
    const view = renderRole("host");
    await deliver(view, snapshot("host", "playing"));
    vi.useFakeTimers();
    try {
      act(() => view.socket().deliver({
        version: 1, type: "error", requestId: null,
        code: "UNAUTHORIZED", message: "Session invalid",
      }));
      act(() => view.socket().close());
      await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
      expect(FakeWebSocket.instances).toHaveLength(1);
    } finally { vi.useRealTimers(); }
  });
});
