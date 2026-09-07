import { describe, expect, it } from "vitest";
import { stackBoost } from "./game/boosts";
import { nextAlphaPity, shouldGuaranteeAlpha } from "./game/packs";
import { LEVEL_UP_ESSENCE_COST, MAX_MYSTIC_LEVEL, RARITY_DISMANTLE_ESSENCE, RARITY_SELL_COINS } from "./game/economy";
import { catalog, combatant, createBattle, dismantleCard, initialState, levelUpCard, rewardCompletedBattle, sellDuplicateCard, type OwnedCard, type PlayerState } from "./client-state";

const owned = (definitionId: string, level = 1): OwnedCard => ({ id: `owned-${definitionId}-${level}-${Math.random()}`, definitionId, acquiredAt: "", level });

describe("battle formation selection", () => {
  it("uses the exact owned cards chosen for a temporary formation", () => {
    const state = structuredClone(initialState);
    state.account = { email: "handler@example.com", username: "Handler" };
    state.ownedCards = catalog.mystics.slice(0, 4).map((card) => owned(card.id));
    const selected = [state.ownedCards[2].id, state.ownedCards[0].id, state.ownedCards[3].id];
    createBattle(state, "rookie", { mysticIds: selected, handlerIds: [] });
    expect(state.battle?.player.mystics.map((card) => card.definitionId)).toEqual(selected.map((id) => state.ownedCards.find((card) => card.id === id)?.definitionId));
  });

  it("builds a valid unique lineup when random is selected", () => {
    const state = structuredClone(initialState);
    state.account = { email: "handler@example.com", username: "Handler" };
    state.ownedCards = catalog.mystics.slice(0, 6).map((card) => owned(card.id));
    createBattle(state, "rookie", { random: true });
    const lineup = state.battle?.player.mystics ?? [];
    expect(lineup).toHaveLength(3);
    expect(new Set(lineup.map((card) => card.instanceId)).size).toBe(3);
  });

  it("computes Order Synergy for the starting lineup and never for a single Mystic", () => {
    const state = structuredClone(initialState);
    state.account = { email: "handler@example.com", username: "Handler" };
    const sameOrder = catalog.mystics.filter((card) => card.order === catalog.mystics[0].order);
    state.ownedCards = sameOrder.slice(0, 3).map((card) => owned(card.id));
    createBattle(state, "rookie", { mysticIds: state.ownedCards.map((card) => card.id) });
    expect(state.battle?.player.synergies[catalog.mystics[0].order]).toBe(10); // 3 matching -> +10%
  });
});

describe("leveled combatant stats", () => {
  it("scales Power/DEF/BaseATK by the level bonus and keeps printed stats for reference", () => {
    const definition = catalog.mystics[0];
    const level10 = combatant(owned(definition.id, 10), 0);
    expect(level10.printedPower).toBe(definition.power);
    expect(level10.maxPower).toBe(Math.floor(definition.power * 1.18 + 0.5));
    expect(level10.baseAttack).toBe(Math.floor(definition.baseAttack * 1.18 + 0.5));
  });

  it("resolves Handler passive bonuses once from equipped Handlers matching Allegiance or Order", () => {
    const mystic = catalog.mystics.find((card) => catalog.handlers.some((h) => h.allegiance === card.allegiance || h.order === card.order))!;
    const handler = catalog.handlers.find((h) => h.allegiance === mystic.allegiance || h.order === mystic.order)!;
    const result = combatant(owned(mystic.id), 0, [handler]);
    expect(result.handlerBonuses.sources).toContain(handler.name);
  });
});

describe("economy rules", () => {
  it("extends same-category boosts without multiplying again", () => expect(stackBoost({ type: "xp", matches: 4 }, { type: "xp", matches: 5 })).toEqual({ type: "xp", matches: 9, multiplier: 2 }));
  it("allows independent XP and coin boost records", () => { const xp = stackBoost(null, { type: "xp", matches: 3 }); const coins = stackBoost(null, { type: "coins", matches: 7 }); expect([xp.multiplier, coins.multiplier]).toEqual([2, 2]); });
  it("guarantees Alpha after nine misses and only Alpha resets", () => { expect(shouldGuaranteeAlpha(9)).toBe(true); expect(nextAlphaPity(9, ["Alpha"])).toBe(0); expect(nextAlphaPity(9, ["Apex"])).toBe(10); });

  it("records a campaign victory and grants its first-clear bonus once", () => {
    const base = (): PlayerState => { const state = structuredClone(initialState); state.battle = { id: "b", size: 3, player: { id: "player", name: "P", mystics: [], handlers: [], synergies: {} }, ai: { id: "ai", name: "Lio of the Lowlands", mystics: [{ ...combatant(owned(catalog.mystics[0].id), 0), currentPower: 0, defeated: true }], handlers: [], synergies: {} }, currentTurn: "player", turnNumber: 1, winner: "player", events: [], lastRoll: null, campaignId: "rookie" }; return state; };

    const state = base();
    rewardCompletedBattle(state);
    expect(state.campaignWins).toEqual(["rookie"]);
    expect(state.lastRewards?.campaignBonus).toBe(90);
    expect(state.wins).toBe(1);

    const state2 = base();
    state2.campaignWins = ["rookie"];
    rewardCompletedBattle(state2);
    expect(state2.campaignWins).toEqual(["rookie"]);
    expect(state2.lastRewards?.campaignBonus).toBe(0);
    expect(state2.wins).toBe(1);
  });
});

describe("card leveling", () => {
  const setup = () => {
    const state = structuredClone(initialState);
    const definition = catalog.mystics[0];
    const card = owned(definition.id, 5);
    state.ownedCards = [card];
    state.essence[definition.order] = 1000;
    return { state, card, definition };
  };

  it("levels up a specific owned instance, deducting the exact Essence cost for the next level", () => {
    const { state, card, definition } = setup();
    levelUpCard(state, card.id);
    expect(card.level).toBe(6);
    expect(state.essence[definition.order]).toBe(1000 - LEVEL_UP_ESSENCE_COST[6]);
  });

  it("throws when Essence is insufficient and does not mutate level", () => {
    const { state, card, definition } = setup();
    state.essence[definition.order] = 0;
    expect(() => levelUpCard(state, card.id)).toThrow();
    expect(card.level).toBe(5);
  });

  it("throws at the maximum level", () => {
    const { state, card } = setup();
    card.level = MAX_MYSTIC_LEVEL;
    expect(() => levelUpCard(state, card.id)).toThrow();
  });
});

describe("duplicate management: sell and dismantle", () => {
  it("sellDuplicateCard requires at least two owned copies and grants rarity-based Coins", () => {
    const definition = catalog.mystics[0];
    const state = structuredClone(initialState);
    const first = owned(definition.id); const second = owned(definition.id);
    state.ownedCards = [first, second];
    expect(() => sellDuplicateCard(state, first.id)).not.toThrow();
    const solo = structuredClone(initialState);
    solo.ownedCards = [owned(definition.id)];
    expect(() => sellDuplicateCard(solo, solo.ownedCards[0].id)).toThrow();
  });

  it("sellDuplicateCard grants the coin value for that card's rarity and removes only that instance", () => {
    const definition = catalog.mystics[0];
    const state = structuredClone(initialState);
    const first = owned(definition.id); const second = owned(definition.id);
    state.ownedCards = [first, second];
    sellDuplicateCard(state, first.id);
    expect(state.coins).toBe(RARITY_SELL_COINS[definition.rarity]);
    expect(state.ownedCards).toEqual([second]);
  });

  it("dismantleCard grants Essence matching the Mystic's Order and removes that instance", () => {
    const definition = catalog.mystics[0];
    const state = structuredClone(initialState);
    const first = owned(definition.id); const second = owned(definition.id);
    state.ownedCards = [first, second];
    dismantleCard(state, first.id);
    expect(state.essence[definition.order]).toBe(RARITY_DISMANTLE_ESSENCE[definition.rarity]);
    expect(state.ownedCards).toEqual([second]);
  });

  it("dismantleCard rejects Handler cards", () => {
    const handler = catalog.handlers[0];
    const state = structuredClone(initialState);
    state.ownedCards = [owned(handler.id), owned(handler.id)];
    expect(() => dismantleCard(state, state.ownedCards[0].id)).toThrow();
  });

  it("dismantleCard requires at least two owned copies", () => {
    const definition = catalog.mystics[0];
    const state = structuredClone(initialState);
    state.ownedCards = [owned(definition.id)];
    expect(() => dismantleCard(state, state.ownedCards[0].id)).toThrow();
  });
});
