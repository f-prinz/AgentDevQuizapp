import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RankingEntry, Snapshot } from "@raccoons/contracts";
import { RankingBoard } from "./RankingBoard";
import { RANKING_TIMELINE } from "./ranking-logic";

const catalog: Snapshot["catalog"] = [
  { id: "quiz-1", kind: "quiz", title: "Weltwissen", rules: "r", played: true },
  { id: "sort-1", kind: "sorting", title: "Jahre ordnen", rules: "r", played: true },
];
const entry = (name: string, rank: number, total: number, games: RankingEntry["games"] = []): RankingEntry =>
  ({ playerId: `player-${name.toLowerCase()}`, name, rank, total, games });

const board = () => document.querySelector<HTMLElement>('section[aria-label="Rangliste"]')!;
const names = (selector: string) => Array.from(document.querySelectorAll(`${selector} [data-ranking-entry] .ranking-name`)).map(el => el.textContent);
const entryOf = (name: string) => document.querySelector<HTMLElement>(`[data-player-id="player-${name.toLowerCase()}"]`)!;
const total = (name: string) => entryOf(name).querySelector(".ranking-total")!.textContent;

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("RankingBoard layout", () => {
  it("puts places 1, 2, 3 left to right on the podium and the rest in the field", () => {
    render(<RankingBoard catalog={catalog} transition={null} ranking={[
      entry("Cyd", 3, 4, [{ gameId: "sort-1", points: 4 }]), entry("Ada", 1, 9, [{ gameId: "quiz-1", points: 4 }, { gameId: "sort-1", points: 5 }]),
      entry("Eve", 5, 1, [{ gameId: "sort-1", points: 1 }]), entry("Bo", 2, 6, [{ gameId: "sort-1", points: 6 }]), entry("Dan", 4, 2, [{ gameId: "sort-1", points: 2 }]),
    ]} />);
    expect(names(".ranking-podium")).toEqual(["Ada", "Bo", "Cyd"]);
    expect(names(".ranking-field")).toEqual(["Dan", "Eve"]);
    expect(entryOf("Ada").textContent).toContain("Jahre ordnen: 5");
    expect(entryOf("Ada").textContent).toContain("Weltwissen: 4");
    expect(total("Ada")).toBe("9");
  });

  it("shows only player names before any game was played", () => {
    render(<RankingBoard catalog={catalog} transition={null} ranking={[entry("Ada", 1, 0), entry("Bo", 1, 0)]} />);
    const list = board().querySelector("ol.ranking-names")!;
    expect(Array.from(list.querySelectorAll("li")).map(li => li.textContent)).toEqual(["Ada", "Bo"]);
    expect(board().querySelector("[data-ranking-entry]")).toBeNull();
  });

  it("shows the real shared rank on every podium block when everybody is tied", () => {
    render(<RankingBoard catalog={catalog} transition={null} ranking={[
      entry("Ada", 1, 0, [{ gameId: "quiz-1", points: 0 }]), entry("Bo", 1, 0, [{ gameId: "quiz-1", points: 0 }]), entry("Cyd", 1, 0, [{ gameId: "quiz-1", points: 0 }]),
    ]} />);
    const ranks = Array.from(document.querySelectorAll(".ranking-podium .ranking-rank")).map(el => el.textContent);
    expect(ranks).toEqual(["1", "1", "1"]);
    // Gleichstand sieht auch gleich aus: Hoehe/Farbe haengen am Rang, nicht am Slot.
    const blocks = Array.from(document.querySelectorAll(".ranking-podium [data-ranking-entry]"));
    expect(blocks.every(block => block.classList.contains("podium-rank-1"))).toBe(true);
  });
});

describe("RankingBoard transition", () => {
  const previous = [entry("Bo", 1, 3, [{ gameId: "sort-1", points: 3 }]), entry("Ada", 2, 1, [{ gameId: "sort-1", points: 1 }]), entry("Cyd", 3, 0, [{ gameId: "sort-1", points: 0 }])];
  const current = [
    entry("Cyd", 1, 8, [{ gameId: "sort-1", points: 0 }, { gameId: "quiz-1", points: 8 }]),
    entry("Ada", 2, 6, [{ gameId: "sort-1", points: 1 }, { gameId: "quiz-1", points: 5 }]),
    entry("Bo", 3, 3, [{ gameId: "sort-1", points: 3 }, { gameId: "quiz-1", points: 0 }]),
  ];
  const transition = { resultId: "result-1", gameId: "quiz-1", previous, current };
  const { holdMs, countMs, reorderMs, flashMs } = RANKING_TIMELINE;

  it("shows the old standings first, counts up, reorders and ends within five seconds", () => {
    render(<RankingBoard catalog={catalog} ranking={current} transition={transition} />);
    expect(board().dataset.rankingStage).toBe("before");
    expect(names(".ranking-podium")).toEqual(["Bo", "Ada", "Cyd"]);
    expect(total("Ada")).toBe("1");

    act(() => { vi.advanceTimersByTime(holdMs + 10); });
    expect(board().dataset.rankingStage).toBe("counting");

    act(() => { vi.advanceTimersByTime(5000 - holdMs - 10); });
    expect(board().dataset.rankingStage).toBe("after");
    expect(names(".ranking-podium")).toEqual(["Cyd", "Ada", "Bo"]);
    expect(total("Cyd")).toBe("8");
  });

  it("flashes players who climbed after the reorder and clears the flash afterwards", () => {
    render(<RankingBoard catalog={catalog} ranking={current} transition={transition} />);
    act(() => { vi.advanceTimersByTime(holdMs + countMs + reorderMs + 10); });
    expect(entryOf("Cyd").classList.contains("ranking-climber")).toBe(true);
    expect(entryOf("Ada").classList.contains("ranking-climber")).toBe(false);
    act(() => { vi.advanceTimersByTime(flashMs); });
    expect(document.querySelector(".ranking-climber")).toBeNull();
  });

  it("jumps straight to the final standings without flashes for reduced motion", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: /reduce/.test(query), media: query, addEventListener: () => {}, removeEventListener: () => {} }));
    render(<RankingBoard catalog={catalog} ranking={current} transition={transition} />);
    expect(board().dataset.rankingStage).toBe("after");
    expect(names(".ranking-podium")).toEqual(["Cyd", "Ada", "Bo"]);
    act(() => { vi.advanceTimersByTime(5000); });
    expect(document.querySelector(".ranking-climber")).toBeNull();
  });

  it("replays only for a new resultId", () => {
    const view = render(<RankingBoard catalog={catalog} ranking={current} transition={transition} />);
    act(() => { vi.advanceTimersByTime(5000); });
    expect(board().dataset.rankingStage).toBe("after");
    view.rerender(<RankingBoard catalog={catalog} ranking={current} transition={{ ...transition }} />);
    act(() => { vi.advanceTimersByTime(100); });
    expect(board().dataset.rankingStage).toBe("after");
    view.rerender(<RankingBoard catalog={catalog} ranking={current} transition={{ ...transition, resultId: "result-2" }} />);
    expect(board().dataset.rankingStage).toBe("before");
  });
});
