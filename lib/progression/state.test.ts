import { describe, expect, it, vi } from "vitest";
import { artworkForOwnedCard, catalog, combatant, grantStandardPack, initialState, buyPack } from "../client-state";
import { DAILY_CHALLENGES, SEASON_ONE_REWARDS, SEASON_TIER_THRESHOLDS } from "./config";
import { addSeasonXp, applyProgressEvent, challengeForDate, claimDailyChallenge, claimSeasonTier, dailyChallengeIndex, dailyPackAvailableAt, defaultProgressionConfig, ensureRetentionNotifications, isDailyPackAvailable, seasonProgressFor, tierForXp, utcDateKey } from "./state";

const stateAt = () => structuredClone(initialState);
describe("global Daily Challenge rotation", () => {
  it("changes on UTC days and wraps Day 31 to Challenge 1", () => {
    expect(challengeForDate(new Date("2026-09-01T12:00:00Z")).day).toBe(1);
    expect(challengeForDate(new Date("2026-09-30T23:59:00Z")).day).toBe(30);
    expect(challengeForDate(new Date("2026-10-01T00:00:00Z")).day).toBe(1);
    expect(dailyChallengeIndex(new Date("2026-08-31T23:59:00Z"))).toBe(29);
  });
  it("tracks progress, survives serialization, and awards once", () => {
    const now = new Date("2026-09-04T10:00:00Z"); const state = stateAt();
    applyProgressEvent(state, { type: "DAMAGE_DEALT", battleId: "a", value: 217 }, now);
    applyProgressEvent(state, { type: "DAMAGE_DEALT", battleId: "b", value: 83 }, now);
    const restored = JSON.parse(JSON.stringify(state)) as typeof state;
    const progress = restored.progression.dailyChallenges[utcDateKey(now)];
    expect(progress.values.damageDealt).toBe(300); expect(progress.completed).toBe(true);
    claimDailyChallenge(restored, now); expect(restored.coins).toBe(100); expect(seasonProgressFor(restored, now).seasonXp).toBe(150);
    expect(() => claimDailyChallenge(restored, now)).toThrow("already claimed");
  });
  it("requires Day 1 to be an actual 5v5 Sovereign-only win", () => {
    const now = new Date("2026-09-01T10:00:00Z"); const state = stateAt();
    const sovereign = Array.from({ length: 5 }, () => "Sovereign Order");
    applyProgressEvent(state, { type: "BATTLE_WON", battleId: "three", teamSize: 3, teamOrders: sovereign.slice(0, 3) }, now);
    expect(state.progression.dailyChallenges[utcDateKey(now)].completed).toBe(false);
    applyProgressEvent(state, { type: "BATTLE_WON", battleId: "five", teamSize: 5, teamOrders: sovereign }, now);
    expect(state.progression.dailyChallenges[utcDateKey(now)].completed).toBe(true);
  });
  it("recognizes an Order-based win challenge from the completed team", () => {
    const now = new Date("2026-09-03T10:00:00Z"); const state = stateAt();
    applyProgressEvent(state, { type: "BATTLE_WON", battleId: "verdant", teamSize: 3, teamOrders: ["Verdant Dawn", "Verdant Dawn", "Verdant Dawn"] }, now);
    expect(state.progression.dailyChallenges[utcDateKey(now)].completed).toBe(true);
  });
  it("recognizes the Day 10 Starwatch challenge using the catalog order name", () => {
    const now = new Date("2026-09-10T10:00:00Z"); const state = stateAt();
    applyProgressEvent(state, { type: "BATTLE_WON", battleId: "starwatch", teamSize: 3, teamOrders: ["Order of the Star", "Order of the Star", "Order of the Star"] }, now);
    expect(state.progression.dailyChallenges[utcDateKey(now)].completed).toBe(true);
  });
  it("keeps single-battle goals separate and distinct lineup/order sets unique", () => {
    const specialDay = new Date("2026-09-09T10:00:00Z"); const state = stateAt();
    applyProgressEvent(state, { type: "SPECIAL_SUCCEEDED", battleId: "a" }, specialDay);
    applyProgressEvent(state, { type: "SPECIAL_SUCCEEDED", battleId: "b" }, specialDay);
    expect(state.progression.dailyChallenges[utcDateKey(specialDay)].completed).toBe(false);
    applyProgressEvent(state, { type: "SPECIAL_SUCCEEDED", battleId: "a" }, specialDay);
    expect(state.progression.dailyChallenges[utcDateKey(specialDay)].completed).toBe(true);
    const lineupDay = new Date("2026-09-23T10:00:00Z"); const other = stateAt();
    for (const lineupKey of ["a|b|c", "a|b|c", "a|b|d"]) applyProgressEvent(other, { type: "BATTLE_WON", lineupKey, teamOrders: [] }, lineupDay);
    expect(other.progression.dailyChallenges[utcDateKey(lineupDay)].values.uniqueWinningLineups).toBe(2);
  });
});

describe("Season Pass", () => {
  it("uses exact stored thresholds with Tier 50 at 15000 XP", () => {
    expect(SEASON_TIER_THRESHOLDS).toHaveLength(50); expect(SEASON_TIER_THRESHOLDS[49]).toBe(15000);
    expect(tierForXp(14999)).toBe(49); expect(tierForXp(15000)).toBe(50);
  });
  it("keeps Season XP separate and makes regular play viable without auto-completing casual play", () => {
    const regular = stateAt(); const casual = stateAt(); const now = new Date("2026-09-10T10:00:00Z");
    regular.xp = 77; addSeasonXp(regular, 15000, now); expect(regular.xp).toBe(77); expect(seasonProgressFor(regular, now).currentTier).toBe(50);
    // Six completed wins per day plus daily completion reaches the target; ten occasional sessions do not.
    const regularMonth = 30 * (6 * 20 + 6 * 30 + 50 + 150); const casualMonth = 10 * (20 + 30 + 50) + 5 * 150;
    expect(regularMonth).toBeGreaterThanOrEqual(15000); expect(tierForXp(casualMonth)).toBeLessThan(15);
  });
  it("awards the configured Season XP for completed and won battles", () => {
    const state = stateAt(); const firstBattle = new Date("2026-09-10T10:00:00Z");
    applyProgressEvent(state, { type: "BATTLE_COMPLETED", battleId: "first" }, firstBattle);
    expect(seasonProgressFor(state, firstBattle).seasonXp).toBe(70);
    applyProgressEvent(state, { type: "BATTLE_WON", battleId: "first" }, firstBattle);
    expect(seasonProgressFor(state, firstBattle).seasonXp).toBe(100);
    applyProgressEvent(state, { type: "BATTLE_COMPLETED", battleId: "second" }, new Date("2026-09-10T12:00:00Z"));
    expect(seasonProgressFor(state, firstBattle).seasonXp).toBe(120);
  });
  it("preserves old progress when a new configured Season starts", () => {
    const state = stateAt(); const first = seasonProgressFor(state, new Date("2026-09-10T00:00:00Z")); first.seasonXp = 900;
    state.progression.configuration = { ...defaultProgressionConfig(), season: { ...defaultProgressionConfig().season, id: "season-02", number: 2, startsAt: "2026-10-01T00:00:00Z", endsAt: "2026-10-31T00:00:00Z" } };
    const second = seasonProgressFor(state, new Date("2026-10-02T00:00:00Z"));
    expect(second.seasonXp).toBe(0); expect(state.progression.seasons["season-01"].seasonXp).toBe(900);
  });
  it("prevents duplicate claims and keeps unresolved placeholders unclaimable", () => {
    const state = stateAt(); addSeasonXp(state, 1000, new Date("2026-09-10T00:00:00Z"));
    claimSeasonTier(state, 1, () => undefined, new Date("2026-09-10T00:00:00Z")); expect(state.coins).toBe(250);
    expect(() => claimSeasonTier(state, 1, () => undefined, new Date("2026-09-10T00:00:00Z"))).toThrow("already claimed");
    expect(() => claimSeasonTier(state, 5, () => undefined, new Date("2026-09-10T00:00:00Z"), { type: "mysticPlaceholder", placeholderId: "test", label: "Not ready" })).toThrow("coming before Season launch");
  });
  it("turns a configured Ascendant Art reward into a transferable owned-card instance", () => {
    const state = stateAt(); const now = new Date("2026-09-10T00:00:00Z");
    addSeasonXp(state, 300, now);
    claimSeasonTier(state, 2, () => undefined, now, { type: "illustrationRare", definitionId: "MM-001", artworkVariant: "season-one-ir", label: "Ascendant Art" });
    expect(state.ownedCards.at(-1)).toMatchObject({ definitionId: "MM-001", variant: "illustrationRare", artworkVariant: "season-one-ir", seasonOrigin: "season-01", level: 1 });
    expect(state.ownedCards.at(-1)).not.toHaveProperty("accountBound");
  });
  it("maps the four Ascendant Art cards to their standard counterparts without changing stats", () => {
    const expected = [
      [10, "MM-001", "season_01_ir_01.png"],
      [20, "MM-002", "season_01_ir_02.png"],
      [40, "MM-003", "season_01_ir_03.png"],
      [50, "MM-029", "season_01_ir_finale.png"],
    ] as const;
    for (const [tier, definitionId, filename] of expected) {
      const reward = SEASON_ONE_REWARDS[tier - 1];
      expect(reward).toMatchObject({ type: "illustrationRare", definitionId });
      expect(reward.artworkVariant).toContain(filename);
      const definition = catalog.mystics.find(item => item.id === definitionId)!;
      const owned = { id: `ir-${tier}`, definitionId, acquiredAt: "2026-09-10T00:00:00Z", level: 1, variant: "illustrationRare", artworkVariant: reward.artworkVariant };
      const card = combatant(owned, 0);
      expect([card.printedPower, card.printedDefense, card.printedBaseAttack]).toEqual([definition.power, definition.defense, definition.baseAttack]);
      expect(artworkForOwnedCard(owned)).toContain(filename.replace(".png", ".webp"));
    }
  });
  it("uses six fixed Alpha Mystics for the regular Season card tiers", () => {
    const rewards = [5, 15, 25, 30, 35, 45].map(tier => SEASON_ONE_REWARDS[tier - 1]);
    expect(rewards.every(reward => reward.type === "mystic" && catalog.mystics.find(card => card.id === reward.definitionId)?.rarity === "Alpha")).toBe(true);
    expect(new Set(rewards.map(reward => reward.definitionId)).size).toBe(6);
  });
});

describe("Daily Pack", () => {
  it("is immediate first, exactly 24 hours thereafter, and early login does not move it", () => {
    expect(isDailyPackAvailable(null)).toBe(true);
    const claimed = "2026-09-07T18:15:00.000Z";
    expect(isDailyPackAvailable(claimed, new Date("2026-09-08T16:00:00Z"))).toBe(false);
    expect(dailyPackAvailableAt(claimed)?.toISOString()).toBe("2026-09-08T18:15:00.000Z");
    expect(isDailyPackAvailable(claimed, new Date("2026-09-08T18:15:00Z"))).toBe(true);
  });
  it("uses the exact Standard Pack generator and does not charge Coins", () => {
    vi.spyOn(Math, "random").mockReturnValue(.42);
    const bought = stateAt(); bought.coins = 500; buyPack(bought, "standard");
    const daily = stateAt(); daily.coins = 500; grantStandardPack(daily, "daily", "Daily Standard Pack");
    expect(daily.openings[0].cards.map(card => [card.kind, card.definitionId, card.rarity, card.amount])).toEqual(bought.openings[0].cards.map(card => [card.kind, card.definitionId, card.rarity, card.amount]));
    expect(daily.coins).toBe(500); expect(bought.coins).toBe(0); vi.restoreAllMocks();
  });
  it("does not repeat availability notifications until another pack has been claimed", () => {
    const state = stateAt();
    ensureRetentionNotifications(state, new Date("2026-09-01T10:00:00Z"));
    ensureRetentionNotifications(state, new Date("2026-09-03T10:00:00Z"));
    expect(state.progression.notifications.filter(item => item.kind === "dailyPack")).toHaveLength(1);
    state.progression.lastDailyPackClaimAt = "2026-09-03T10:00:00.000Z";
    ensureRetentionNotifications(state, new Date("2026-09-04T10:00:00Z"));
    expect(state.progression.notifications.filter(item => item.kind === "dailyPack")).toHaveLength(2);
  });
});

it("defines exactly thirty configured challenges and fifty rewards", () => {
  expect(DAILY_CHALLENGES.map(item => item.day)).toEqual(Array.from({ length: 30 }, (_, index) => index + 1));
  expect(SEASON_ONE_REWARDS).toHaveLength(50);
});
