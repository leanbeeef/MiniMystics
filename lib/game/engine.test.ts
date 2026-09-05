import { describe, expect, it } from "vitest";
import { calculateDamage, canUseHandler, checkVictory, performSpecial, tickCooldowns } from "./engine";
import { stackBoost } from "./boosts";
import { nextAlphaPity, shouldGuaranteeAlpha } from "./packs";
import type { BattleState, Combatant, ParsedMove } from "./types";
import { catalog, createBattle, initialState, rewardCompletedBattle } from "../client-state";

const move = (overrides: Partial<ParsedMove> = {}): ParsedMove => ({ name: "Quickstrike", requiredRoll: 4, minimumRoll: 4, attackModifier: 8, cooldown: 1, targetType: "enemy", rawText: "Quickstrike: 4+ = +8 ATK", needsReview: false, ...overrides });
const fighter = (id: string, baseAttack = 12, defense = 5): Combatant => ({ instanceId: id, definitionId: id, name: id, image: null, rarity: "Wild", order: "Test", maxPower: 30, currentPower: 30, defense, baseAttack, moves: [move()], cooldowns: {}, effects: [], defeated: false });
const battle = (): BattleState => ({ id: "test", size: 3, player: { id: "player", name: "Player", mystics: [fighter("p")], handlers: [] }, ai: { id: "ai", name: "AI", mystics: [fighter("a")], handlers: [] }, currentTurn: "player", turnNumber: 1, winner: null, events: [], lastRoll: null });

describe("battle math", () => {
  it("calculates damage and enforces the minimum", () => { expect(calculateDamage(12, 5)).toBe(7); expect(calculateDamage(4, 10)).toBe(1); });
  it("applies a special attack bonus", () => { const s = battle(); const out = performSpecial(s, "player", "p", "a", 0, { rollD6: () => 5 }); expect(out.damage).toBe(15); });
  it("applies defense to each multi-hit", () => { const s = battle(); s.player.mystics[0].moves[0] = move({ attackModifier: undefined, multiHitCount: 2 }); const out = performSpecial(s, "player", "p", "a", 0, { rollD6: () => 6 }); expect(out.damage).toBe(14); });
  it("consumes a failed special and starts cooldown", () => { const s = battle(); const out = performSpecial(s, "player", "p", "a", 0, { rollD6: () => 2 }); expect(out.damage).toBe(0); expect(s.player.mystics[0].cooldowns.Quickstrike).toBe(2); expect(s.currentTurn).toBe("ai"); });
  it("ticks CD 1 across the owner's turns", () => { const s = battle(); s.player.mystics[0].cooldowns.Quickstrike = 2; tickCooldowns(s.player); expect(s.player.mystics[0].cooldowns.Quickstrike).toBe(1); tickCooldowns(s.player); expect(s.player.mystics[0].cooldowns.Quickstrike).toBe(0); });
  it("marks a zero-power Mystic defeated and detects victory", () => { const s = battle(); s.ai.mystics[0].currentPower = 0; s.ai.mystics[0].defeated = true; expect(checkVictory(s)).toBe("player"); });
  it("prevents Handler uses above Max Uses", () => { expect(canUseHandler(1, 1)).toBe(false); expect(canUseHandler(1, 2)).toBe(true); });
});

describe("battle formation selection", () => {
  it("uses the exact owned cards chosen for a temporary formation", () => {
    const state = structuredClone(initialState);
    state.account = { email: "handler@example.com", username: "Handler" };
    state.ownedCards = catalog.mystics.slice(0, 4).map((card, index) => ({ id: `owned-${index}`, definitionId: card.id, acquiredAt: "" }));
    const selected = [state.ownedCards[2].id, state.ownedCards[0].id, state.ownedCards[3].id];
    createBattle(state, "rookie", { mysticIds: selected, handlerIds: [] });
    expect(state.battle?.player.mystics.map((card) => card.definitionId)).toEqual(selected.map((id) => state.ownedCards.find((card) => card.id === id)?.definitionId));
  });

  it("builds a valid unique lineup when random is selected", () => {
    const state = structuredClone(initialState);
    state.account = { email: "handler@example.com", username: "Handler" };
    state.ownedCards = catalog.mystics.slice(0, 6).map((card, index) => ({ id: `owned-${index}`, definitionId: card.id, acquiredAt: "" }));
    createBattle(state, "rookie", { random: true });
    const lineup = state.battle?.player.mystics ?? [];
    expect(lineup).toHaveLength(3);
    expect(new Set(lineup.map((card) => card.instanceId)).size).toBe(3);
  });
});

describe("economy rules", () => {
  it("extends same-category boosts without multiplying again", () => expect(stackBoost({ type: "xp", matches: 4 }, { type: "xp", matches: 5 })).toEqual({ type: "xp", matches: 9, multiplier: 2 }));
  it("allows independent XP and coin boost records", () => { const xp = stackBoost(null, { type: "xp", matches: 3 }); const coins = stackBoost(null, { type: "coins", matches: 7 }); expect([xp.multiplier, coins.multiplier]).toEqual([2, 2]); });
  it("guarantees Alpha after nine misses and only Alpha resets", () => { expect(shouldGuaranteeAlpha(9)).toBe(true); expect(nextAlphaPity(9, ["Alpha"])).toBe(0); expect(nextAlphaPity(9, ["Apex"])).toBe(10); });
  it("records a campaign victory and grants its first-clear bonus once", () => {
    const state = structuredClone(initialState);
    state.battle = { ...battle(), campaignId: "rookie", winner: "player", ai: { ...battle().ai, name: "Lio of the Lowlands", mystics: [{ ...fighter("a"), currentPower: 0, defeated: true }] } };
    rewardCompletedBattle(state);
    expect(state.campaignWins).toEqual(["rookie"]);
    expect(state.lastRewards?.campaignBonus).toBe(90);
    expect(state.wins).toBe(1);

    state.battle = { ...battle(), campaignId: "rookie", winner: "player", ai: { ...battle().ai, name: "Lio of the Lowlands", mystics: [{ ...fighter("a2"), currentPower: 0, defeated: true }] } };
    state.battleRewarded = false;
    rewardCompletedBattle(state);
    expect(state.campaignWins).toEqual(["rookie"]);
    expect(state.lastRewards?.campaignBonus).toBe(0);
    expect(state.wins).toBe(2);
  });
});
