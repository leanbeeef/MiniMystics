import { describe, expect, it } from "vitest";
import { stackBoost } from "./game/boosts";
import { nextAlphaPity, shouldGuaranteeAlpha } from "./game/packs";
import { LEVEL_UP_ESSENCE_COST, MAX_MYSTIC_LEVEL, RARITY_DISMANTLE_ESSENCE, RARITY_SELL_COINS } from "./game/economy";
import { ALL_CAMPAIGN_STAGES, buyPack, catalog, combatant, createBattle, dismantleCard, disposableDuplicate, drawUniqueMystics, initialState, levelUpCard, rewardCompletedBattle, sellDuplicateCard, setActiveLoadout, type OwnedCard, type PlayerState } from "./client-state";
import { PACK_DEFINITIONS, weightedRarity } from "./game/packs";
import type { MysticDefinition } from "./game/types";

const owned = (definitionId: string, level = 1): OwnedCard => ({ id: `owned-${definitionId}-${level}-${Math.random()}`, definitionId, acquiredAt: "", level });

describe("battle formation selection", () => {
  it("uses the exact owned cards chosen for a temporary formation", () => {
    const state = structuredClone(initialState);
    state.account = { email: "handler@example.com", username: "Handler" };
    state.ownedCards = catalog.mystics.slice(0, 4).map((card) => owned(card.id));
    const selected = [state.ownedCards[2].id, state.ownedCards[0].id, state.ownedCards[3].id];
    createBattle(state, ALL_CAMPAIGN_STAGES[0].id, { mysticIds: selected, handlerIds: [] });
    expect(state.battle?.player.mystics.map((card) => card.definitionId)).toEqual(selected.map((id) => state.ownedCards.find((card) => card.id === id)?.definitionId));
  });

  it("builds a valid unique lineup when random is selected", () => {
    const state = structuredClone(initialState);
    state.account = { email: "handler@example.com", username: "Handler" };
    state.ownedCards = catalog.mystics.slice(0, 6).map((card) => owned(card.id));
    createBattle(state, ALL_CAMPAIGN_STAGES[0].id, { random: true });
    const lineup = state.battle?.player.mystics ?? [];
    expect(lineup).toHaveLength(3);
    expect(new Set(lineup.map((card) => card.instanceId)).size).toBe(3);
  });

  it("prefers the active loadout for the opponent's battle size when no explicit selection is given", () => {
    const state = structuredClone(initialState);
    state.account = { email: "handler@example.com", username: "Handler" };
    state.ownedCards = catalog.mystics.slice(0, 5).map((card) => owned(card.id));
    const activeMysticIds = [state.ownedCards[3].id, state.ownedCards[4].id, state.ownedCards[0].id];
    state.loadouts = [
      { id: "inactive-3", name: "Bench", size: 3, mysticIds: [state.ownedCards[0].id, state.ownedCards[1].id, state.ownedCards[2].id], handlerIds: [], active: false },
      { id: "active-3", name: "Starters", size: 3, mysticIds: activeMysticIds, handlerIds: [], active: true },
    ];
    createBattle(state, ALL_CAMPAIGN_STAGES[0].id); // the first campaign stage requires a 3-Mystic formation, no selection passed
    expect(state.battle?.player.mystics.map((card) => card.definitionId)).toEqual(activeMysticIds.map((id) => state.ownedCards.find((card) => card.id === id)?.definitionId));
  });

  it("an explicit selection overrides the active loadout even when one exists", () => {
    const state = structuredClone(initialState);
    state.account = { email: "handler@example.com", username: "Handler" };
    state.ownedCards = catalog.mystics.slice(0, 4).map((card) => owned(card.id));
    state.loadouts = [{ id: "active-3", name: "Starters", size: 3, mysticIds: state.ownedCards.slice(0, 3).map((c) => c.id), handlerIds: [], active: true }];
    const explicit = [state.ownedCards[1].id, state.ownedCards[2].id, state.ownedCards[3].id];
    createBattle(state, ALL_CAMPAIGN_STAGES[0].id, { mysticIds: explicit, handlerIds: [] });
    expect(state.battle?.player.mystics.map((card) => card.definitionId)).toEqual(explicit.map((id) => state.ownedCards.find((card) => card.id === id)?.definitionId));
  });

  it("computes Order Synergy for the starting lineup and never for a single Mystic", () => {
    const state = structuredClone(initialState);
    state.account = { email: "handler@example.com", username: "Handler" };
    const sameOrder = catalog.mystics.filter((card) => card.order === catalog.mystics[0].order);
    state.ownedCards = sameOrder.slice(0, 3).map((card) => owned(card.id));
    createBattle(state, ALL_CAMPAIGN_STAGES[0].id, { mysticIds: state.ownedCards.map((card) => card.id) });
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
    const stage = ALL_CAMPAIGN_STAGES[0];
    const base = (): PlayerState => { const state = structuredClone(initialState); state.battle = { id: "b", size: 3, player: { id: "player", name: "P", mystics: [], handlers: [], synergies: {} }, ai: { id: "ai", name: stage.opponentName, mystics: [{ ...combatant(owned(catalog.mystics[0].id), 0), currentPower: 0, defeated: true }], handlers: [], synergies: {} }, currentTurn: "player", turnNumber: 1, winner: "player", events: [], lastRoll: null, campaignId: stage.id }; return state; };

    const state = base();
    rewardCompletedBattle(state);
    expect(state.campaignWins).toEqual([stage.id]);
    expect(state.lastRewards?.campaignBonus).toBe(stage.firstClearReward.coins);
    expect(state.wins).toBe(1);

    const state2 = base();
    state2.campaignWins = [stage.id];
    rewardCompletedBattle(state2);
    expect(state2.campaignWins).toEqual([stage.id]);
    expect(state2.lastRewards?.campaignBonus).toBe(0);
    expect(state2.wins).toBe(1);
  });
});

function fakeMystic(id: string, overrides: Partial<MysticDefinition> = {}): MysticDefinition {
  return { id, name: id, order: "Worldforge", allegiance: "Unbound", rarity: "Wild", power: 50, defense: 20, baseAttack: 15, moves: [], image: null, ...overrides };
}

describe("drawUniqueMystics (pack duplicate protection)", () => {
  it("never draws the same Mystic twice when the pool is at least as large as the count", () => {
    for (let trial = 0; trial < 25; trial += 1) {
      const drawn = drawUniqueMystics(5, catalog.mystics, () => weightedRarity());
      expect(new Set(drawn.map((card) => card.id)).size).toBe(5);
    }
  });

  it("degrades gracefully (allows a repeat, never hangs) when the pool is smaller than the requested count", () => {
    const tinyPool = [fakeMystic("A"), fakeMystic("B")];
    const drawn = drawUniqueMystics(5, tinyPool, () => "Wild");
    expect(drawn).toHaveLength(5);
    expect(drawn.every((card) => card.id === "A" || card.id === "B")).toBe(true);
  });

  it("draws every card from a pool exactly the requested size with no duplicates or omissions", () => {
    const pool = [fakeMystic("A"), fakeMystic("B"), fakeMystic("C")];
    const drawn = drawUniqueMystics(3, pool, () => "Wild");
    expect(drawn.map((card) => card.id).sort()).toEqual(["A", "B", "C"]);
  });
});

describe("buyPack duplicate protection end to end", () => {
  const richState = () => { const state = structuredClone(initialState); state.account = { email: "handler@example.com", username: "Handler" }; state.coins = 1_000_000; return state; };

  it("standard pack never contains the same Mystic twice", () => {
    for (let trial = 0; trial < 15; trial += 1) {
      const state = richState();
      buyPack(state, "standard");
      const mysticIds = state.openings[0].cards.filter((card) => card.kind === "mystic").map((card) => card.definitionId);
      expect(new Set(mysticIds).size).toBe(mysticIds.length);
    }
  });

  it("order/random-order/void packs never contain the same Mystic twice", () => {
    const order = catalog.mystics[0].order;
    for (const packId of ["order", "random-order", "void"]) {
      for (let trial = 0; trial < 10; trial += 1) {
        const state = richState();
        buyPack(state, packId, order);
        const mysticIds = state.openings[0].cards.filter((card) => card.kind === "mystic").map((card) => card.definitionId);
        expect(new Set(mysticIds).size).toBe(mysticIds.length);
      }
    }
  });

  it("Standard Pack no longer guarantees a Handler or bonus reward cards", () => {
    const standard = PACK_DEFINITIONS.find((pack) => pack.id === "standard")!;
    expect(standard.handlerChancePercent).toBeLessThan(100);
    expect(standard.bonusRewardChancePercent).toBeLessThan(100);
    expect(standard.coinPrice).toBe(500);
  });

  it("Handler Pack still guarantees a Handler", () => {
    const state = richState();
    buyPack(state, "handler");
    expect(state.openings[0].cards).toHaveLength(1);
    expect(state.openings[0].cards[0].kind).toBe("handler");
  });
});

describe("weightedRarity distribution", () => {
  it("roughly matches the configured rarity weights over a large sample", () => {
    const counts: Record<string, number> = {};
    const samples = 20_000;
    for (let i = 0; i < samples; i += 1) { const rarity = weightedRarity(); counts[rarity] = (counts[rarity] ?? 0) + 1; }
    // Wild is the dominant weight (53 of ~100 total) — assert it lands in a generous band around 53%.
    expect((counts.Wild ?? 0) / samples).toBeGreaterThan(0.45);
    expect((counts.Wild ?? 0) / samples).toBeLessThan(0.61);
    // Apex is the rarest (0.5 of ~100 total) — assert it's rare but not literally impossible over 20k samples.
    expect((counts.Apex ?? 0) / samples).toBeLessThan(0.02);
  });
});

describe("setActiveLoadout", () => {
  it("activates a loadout and deactivates any other loadout of the same size", () => {
    const state = structuredClone(initialState);
    state.loadouts = [
      { id: "a", name: "A", size: 3, mysticIds: [], handlerIds: [], active: true },
      { id: "b", name: "B", size: 3, mysticIds: [], handlerIds: [] },
    ];
    setActiveLoadout(state, "b");
    expect(state.loadouts.find((l) => l.id === "a")?.active).toBe(false);
    expect(state.loadouts.find((l) => l.id === "b")?.active).toBe(true);
  });

  it("does not affect a loadout of a different size", () => {
    const state = structuredClone(initialState);
    state.loadouts = [
      { id: "a", name: "A", size: 3, mysticIds: [], handlerIds: [] },
      { id: "b", name: "B", size: 5, mysticIds: [], handlerIds: [], active: true },
    ];
    setActiveLoadout(state, "a");
    expect(state.loadouts.find((l) => l.id === "a")?.active).toBe(true);
    expect(state.loadouts.find((l) => l.id === "b")?.active).toBe(true);
  });

  it("toggles off when activating an already-active loadout", () => {
    const state = structuredClone(initialState);
    state.loadouts = [{ id: "a", name: "A", size: 3, mysticIds: [], handlerIds: [], active: true }];
    setActiveLoadout(state, "a");
    expect(state.loadouts[0].active).toBe(false);
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
  for (const [name, action] of [["sell", sellDuplicateCard], ["dismantle", dismantleCard]] as const) {
    it(`${name} consumes new duplicates while preserving the leveled copy and its references`, () => {
      const state = structuredClone(initialState);
      const definition = catalog.mystics[0];
      const upgraded = owned(definition.id, 5);
      const duplicates = [owned(definition.id), owned(definition.id)];
      state.ownedCards = [upgraded, ...duplicates];
      state.binders = [{ id: "binder", name: "Favorites", cardIds: [upgraded.id] }];
      state.loadouts = [{ id: "team", name: "Team", size: 3, mysticIds: [upgraded.id], handlerIds: [] }];
      for (const copy of duplicates) {
        const target = disposableDuplicate(state.ownedCards, upgraded.id);
        expect(target?.id).toBe(copy.id);
        action(state, target!.id);
      }
      expect(state.ownedCards).toEqual([upgraded]);
      expect(upgraded.level).toBe(5);
      expect(state.binders[0].cardIds).toEqual([upgraded.id]);
      expect(state.loadouts[0].mysticIds).toEqual([upgraded.id]);
      expect(disposableDuplicate(state.ownedCards, upgraded.id)).toBeUndefined();
      expect(state.coins).toBe(name === "sell" ? 2 * RARITY_SELL_COINS[definition.rarity] : 0);
      expect(state.essence[definition.order] ?? 0).toBe(name === "dismantle" ? 2 * RARITY_DISMANTLE_ESSENCE[definition.rarity] : 0);
    });

    it(`${name} rejects a leveled target without changing state`, () => {
      const state = structuredClone(initialState);
      const upgraded = owned(catalog.mystics[0].id, 5);
      state.ownedCards = [upgraded, owned(upgraded.definitionId)];
      const before = structuredClone(state);
      expect(() => action(state, upgraded.id)).toThrow("Leveled cards are protected");
      expect(state).toEqual(before);
    });

    it(`${name} rejects a copy leveled after confirmation opened`, () => {
      const state = structuredClone(initialState);
      const definition = catalog.mystics[0];
      const upgraded = owned(definition.id, 5);
      state.ownedCards = [upgraded, owned(definition.id)];
      const target = disposableDuplicate(state.ownedCards, upgraded.id)!;
      state.essence[definition.order] = 1000;
      levelUpCard(state, target.id);
      const before = structuredClone(state);
      expect(() => action(state, target.id)).toThrow("Leveled cards are protected");
      expect(state).toEqual(before);
      expect(disposableDuplicate(state.ownedCards, upgraded.id)).toBeUndefined();
    });
  }

  it("only selects an unlevelled duplicate of the inspected definition", () => {
    const upgraded = owned(catalog.mystics[0].id, 5);
    const other = owned(catalog.mystics[1].id);
    expect(disposableDuplicate([upgraded, other], upgraded.id)).toBeUndefined();
    const first = owned(upgraded.definitionId);
    const second = owned(upgraded.definitionId);
    expect(disposableDuplicate([upgraded, first, second], second.id)).toBe(second);
  });

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


describe("Apex packs", () => {
  it("imports all eleven Apex Mystics with distinct artwork and parsed moves", () => {
    const apex = catalog.mystics.filter(card => card.rarity === "Apex");
    expect(apex).toHaveLength(11);
    expect(new Set(apex.map(card => card.image)).size).toBe(11);
    expect(apex.every(card => card.image?.includes("Apex%20Cards/") && card.moves.every(move => !move.needsReview))).toBe(true);
    expect(catalog.handlers.find(card => card.name === "Arch, The Fallen")?.image).not.toContain("Arch_apex");
  });
  it("charges 15000 for exactly one random Apex without changing pity or bonuses", () => {
    for (let trial = 0; trial < 30; trial++) {
      const state = structuredClone(initialState); state.coins = 15000; state.pity = 7;
      buyPack(state, "apex");
      expect(state.coins).toBe(0); expect(state.pity).toBe(7);
      expect(state.openings).toHaveLength(1); expect(state.openings[0].cards).toHaveLength(1);
      expect(state.openings[0].cards[0]).toMatchObject({ kind: "mystic", rarity: "Apex", revealed: false });
      expect(state.ownedCards).toHaveLength(1); expect(state.inventory).toHaveLength(0); expect(state.xp).toBe(0);
      expect(state.ownedCards[0].definitionId).toBe(state.openings[0].cards[0].definitionId);
    }
  });
  it("rejects insufficient coins without altering the account", () => {
    const state = structuredClone(initialState); state.coins = 14999;
    const before = structuredClone(state);
    expect(() => buyPack(state, "apex")).toThrow("Not enough Coins");
    expect(state).toEqual(before);
  });
});
