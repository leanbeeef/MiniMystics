import { describe, expect, it } from "vitest";
import { normalizeHandlerName, validateHandlerName } from "./player-profile";

describe("Handler names", () => {
  it("normalizes names case-insensitively", () => {
    expect(normalizeHandlerName("  Star_Keeper  ")).toBe("star_keeper");
  });

  it("accepts the supported public-name format", () => {
    expect(validateHandlerName("leanbeef")).toBeNull();
    expect(validateHandlerName("Mara-Ironhand")).toBeNull();
    expect(validateHandlerName("Star_Keeper7")).toBeNull();
  });

  it("rejects invalid, reserved, and blocked names", () => {
    expect(validateHandlerName("ab")).toMatch(/3 to 20/);
    expect(validateHandlerName("two words")).toMatch(/letters, numbers/);
    expect(validateHandlerName("MiniMystics")).toMatch(/reserved/);
    expect(validateHandlerName("badshitname")).toMatch(/different/);
  });
});
