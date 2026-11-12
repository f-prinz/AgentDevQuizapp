import { describe, expect, it } from "vitest";
import { submissionCount } from "./submission";

describe("submissionCount", () => {
  it("counts every non-waiting participant (also disconnected ones) and treats a missing flag as open", () => {
    expect(submissionCount([
      { id: "a", name: "Ada", number: 1, connected: true, waiting: false, submitted: true },
      { id: "b", name: "Bo", number: 2, connected: false, waiting: false, submitted: false },
      { id: "c", name: "Cyd", number: 3, connected: true, waiting: true, submitted: false },
      { id: "d", name: "Dan", number: 4, connected: true, waiting: false },
    ])).toEqual({ submitted: 1, total: 3 });
  });

  it("reaches total once every playing participant has submitted although someone is waiting", () => {
    expect(submissionCount([
      { id: "a", name: "Ada", number: 1, connected: true, waiting: false, submitted: true },
      { id: "c", name: "Cyd", number: 3, connected: true, waiting: true, submitted: false },
    ])).toEqual({ submitted: 1, total: 1 });
  });
});
