import { describe, expect, it } from "vitest";
import type { RankingEntry } from "@raccoons/contracts";
import { RANKING_TIMELINE, climbers, hasPlayedAnyGame, interpolateTotal, sortByRank, splitPodium } from "./ranking-logic";

const entry = (name: string, rank: number, total = 0, games: RankingEntry["games"] = []): RankingEntry =>
  ({ playerId: `player-${name.toLowerCase()}`, name, rank, total, games });

describe("splitPodium", () => {
  it("puts places 1, 2, 3 left to right on the podium and the rest in the field", () => {
    const { podium, field } = splitPodium([entry("Cyd", 3), entry("Ada", 1), entry("Eve", 5), entry("Bo", 2), entry("Dan", 4)]);
    expect(podium.map(e => e.name)).toEqual(["Ada", "Bo", "Cyd"]);
    expect(field.map(e => e.name)).toEqual(["Dan", "Eve"]);
  });

  it("keeps input order for ties and fills the podium with the first three", () => {
    const { podium, field } = splitPodium([entry("Ada", 1), entry("Bo", 1), entry("Cyd", 1), entry("Dan", 1)]);
    expect(podium.map(e => e.name)).toEqual(["Ada", "Bo", "Cyd"]);
    expect(podium.every(e => e.rank === 1)).toBe(true);
    expect(field.map(e => e.name)).toEqual(["Dan"]);
  });

  it("shows a shorter podium and an empty field for two players", () => {
    const { podium, field } = splitPodium([entry("Bo", 2), entry("Ada", 1)]);
    expect(podium).toHaveLength(2);
    expect(field).toHaveLength(0);
  });
});

describe("sortByRank", () => {
  it("does not mutate its input", () => {
    const input = [entry("Bo", 2), entry("Ada", 1)];
    sortByRank(input);
    expect(input.map(e => e.name)).toEqual(["Bo", "Ada"]);
  });
});

describe("hasPlayedAnyGame", () => {
  it("is false while nobody has game points and true once one entry has", () => {
    expect(hasPlayedAnyGame([entry("Ada", 1), entry("Bo", 1)])).toBe(false);
    expect(hasPlayedAnyGame([entry("Ada", 1, 3, [{ gameId: "g", points: 3 }]), entry("Bo", 2)])).toBe(true);
    expect(hasPlayedAnyGame([])).toBe(false);
  });
});

describe("climbers", () => {
  it("returns players whose position improved and ignores newcomers", () => {
    const previous = [entry("Bo", 1), entry("Ada", 2), entry("Cyd", 3)];
    const current = [entry("Ada", 1), entry("Cyd", 2), entry("Bo", 3), entry("Neu", 4)];
    expect(climbers(previous, current)).toEqual(new Set(["player-ada", "player-cyd"]));
  });

  it("does not flash tied players whose order merely changed", () => {
    const previous = [entry("Ada", 1), entry("Bo", 1), entry("Cyd", 3)];
    const current = [entry("Bo", 1), entry("Ada", 1), entry("Cyd", 3)];
    expect(climbers(previous, current)).toEqual(new Set());
  });
});

describe("interpolateTotal", () => {
  it("counts from the old to the new total and clamps progress", () => {
    expect(interpolateTotal(1, 6, 0)).toBe(1);
    expect(interpolateTotal(1, 6, 0.5)).toBe(4);
    expect(interpolateTotal(1, 6, 2)).toBe(6);
    expect(interpolateTotal(1, 6, -1)).toBe(1);
  });
});

describe("RANKING_TIMELINE", () => {
  it("keeps the whole ranking animation within five seconds", () => {
    const total = RANKING_TIMELINE.holdMs + RANKING_TIMELINE.countMs + RANKING_TIMELINE.reorderMs + RANKING_TIMELINE.flashMs;
    expect(total).toBeLessThanOrEqual(5000);
  });
});
