import { describe, expect, it } from "vitest";
import { roundHalfUp } from "./rounding";

describe("roundHalfUp", () => {
  it.each([
    [47.4, 47], [47.5, 48], [47.9, 48],
    [0.49, 0], [0.5, 1], [0.999, 1],
    [10, 10], [-0.4, 0],
  ])("rounds %d to %d", (input, expected) => {
    expect(roundHalfUp(input)).toBe(expected);
  });
});
