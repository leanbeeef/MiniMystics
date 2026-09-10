import { describe, expect, it } from "vitest";
import { initialState, type PlayerState } from "./client-state";
import { selectHydratedGameState } from "./game-state-merge";

function savedState(saveRevision = 0): PlayerState {
  const state = structuredClone(initialState);
  state.saveRevision = saveRevision;
  state.account = { email: "handler@example.com", username: "Handler" };
  return state;
}

describe("selectHydratedGameState", () => {
  it("keeps a newer local revision and requests a cloud repair", () => {
    const local = savedState(4);
    local.coins = 250;
    const cloud = savedState(3);
    cloud.coins = 800;

    const result = selectHydratedGameState(local, cloud);

    expect(result.state.coins).toBe(250);
    expect(result.cloudNeedsUpdate).toBe(true);
  });

  it("accepts a newer cloud revision", () => {
    const local = savedState(2);
    const cloud = savedState(5);
    cloud.coins = 1_200;

    const result = selectHydratedGameState(local, cloud);

    expect(result.state.coins).toBe(1_200);
    expect(result.cloudNeedsUpdate).toBe(false);
  });

  it("recovers a locally purchased pack from an unversioned cloud snapshot", () => {
    const local = savedState();
    local.coins = 600;
    local.openings = [{ id: "opening-new", packId: "standard", name: "Standard Pack", complete: false, cards: [] }];
    local.activeOpeningId = "opening-new";
    const cloud = savedState();
    cloud.coins = 800;

    const result = selectHydratedGameState(local, cloud);

    expect(result.state.activeOpeningId).toBe("opening-new");
    expect(result.state.coins).toBe(600);
    expect(result.cloudNeedsUpdate).toBe(true);
  });

  it("recovers a local campaign clear from an unversioned cloud snapshot", () => {
    const local = savedState();
    local.coins = 975;
    local.campaignWins = ["stage-cloud", "stage-local"];
    const cloud = savedState();
    cloud.campaignWins = ["stage-cloud"];

    const result = selectHydratedGameState(local, cloud);

    expect(result.state.coins).toBe(975);
    expect(result.state.campaignWins).toEqual(expect.arrayContaining(["stage-local", "stage-cloud"]));
    expect(result.cloudNeedsUpdate).toBe(true);
  });

  it("preserves normalized cloud clears when legacy snapshots diverge", () => {
    const local = savedState();
    local.campaignWins = ["stage-local"];
    const cloud = savedState();
    cloud.campaignWins = ["stage-cloud"];

    const result = selectHydratedGameState(local, cloud);

    expect(result.state.campaignWins).toEqual(expect.arrayContaining(["stage-local", "stage-cloud"]));
    expect(result.cloudNeedsUpdate).toBe(true);
  });

  it("keeps authoritative cloud claim markers when the local snapshot has a newer revision", () => {
    const local = savedState(8);
    local.progression.lastDailyPackClaimAt = null;
    local.progression.seasons["season-01"] = {
      seasonId: "season-01", seasonXp: 500, currentTier: 3, claimedTiers: [], updatedAt: "2026-09-09T12:00:00.000Z",
    };
    const cloud = savedState(7);
    cloud.progression.lastDailyPackClaimAt = "2026-09-09T10:00:00.000Z";
    cloud.progression.seasons["season-01"] = {
      seasonId: "season-01", seasonXp: 250, currentTier: 2, claimedTiers: [1, 2], updatedAt: "2026-09-09T11:00:00.000Z",
    };
    cloud.progression.dailyChallenges["2026-09-09"] = {
      challengeId: "daily-01", challengeDate: "2026-09-09", values: { battleWon: 1 }, sets: {}, battleValues: {}, completed: true, rewardClaimed: true,
    };

    const result = selectHydratedGameState(local, cloud);

    expect(result.state.progression.lastDailyPackClaimAt).toBe("2026-09-09T10:00:00.000Z");
    expect(result.state.progression.seasons["season-01"].seasonXp).toBe(500);
    expect(result.state.progression.seasons["season-01"].claimedTiers).toEqual([1, 2]);
    expect(result.state.progression.dailyChallenges["2026-09-09"].rewardClaimed).toBe(true);
    expect(result.cloudNeedsUpdate).toBe(true);
  });
});
