import { describe, expect, it } from "vitest";
import { initialState } from "./client-state";
import { reconcileAdminBalance } from "./admin-balance";
import { selectHydratedGameState } from "./game-state-merge";

describe("admin balance reconciliation", () => {
  it("recovers a 100000 coin grant missing from a legacy save, exactly once", () => {
    const state = structuredClone(initialState);
    state.coins = 250;
    const totals = { coins: 100_000, premium: 50 };
    reconcileAdminBalance(state, totals);
    expect(state.coins).toBe(100_250);
    expect(state.premium).toBe(50);
    reconcileAdminBalance(state, totals);
    expect(state.coins).toBe(100_250);
    expect(state.premium).toBe(50);
  });

  it("preserves newer offline progress while incorporating the cloud grant", () => {
    const local = structuredClone(initialState);
    local.saveRevision = 10;
    local.coins = 150;
    const cloud = structuredClone(initialState);
    cloud.saveRevision = 9;
    cloud.coins = 250;
    reconcileAdminBalance(cloud, { coins: 100_000, premium: 0 });
    const result = selectHydratedGameState(local, cloud);
    expect(result.state.coins).toBe(100_150);
    expect(result.cloudNeedsUpdate).toBe(true);
    expect(selectHydratedGameState(result.state, cloud).state.coins).toBe(100_150);
  });

  it("applies subsequent grants and deductions without replaying earlier grants", () => {
    const state = structuredClone(initialState);
    reconcileAdminBalance(state, { coins: 100_000, premium: 50 });
    state.coins -= 200;
    reconcileAdminBalance(state, { coins: 99_500, premium: 75 });
    expect(state.coins).toBe(99_300);
    expect(state.premium).toBe(75);
  });

  it("does not let a deduction make an offline balance negative", () => {
    const state = structuredClone(initialState);
    state.coins = 20;
    reconcileAdminBalance(state, { coins: -100, premium: 0 });
    expect(state.coins).toBe(0);
    reconcileAdminBalance(state, { coins: -100, premium: 0 });
    expect(state.coins).toBe(0);
  });
});
