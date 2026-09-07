import { describe, expect, it } from "vitest";
import { calculateDamage, checkVictory, effectiveDefense, endTurn, isMoveSuccessful, performBasicAttack, performSpecial, tickCooldowns } from "./engine";
import { levelBonusPercent } from "./economy";
import { roundHalfUp } from "./rounding";
import type { BattleSide, BattleState, Combatant, EffectSpec, HandlerBonuses, ParsedMove, StatusEffect } from "./types";

const noBonuses = (): HandlerBonuses => ({ atkPercent: 0, defPercent: 0, powerPercent: 0, cooldownReductionPerUse: 0, cooldownReductionFloor: 1, sources: [] });

const move = (overrides: Partial<ParsedMove> = {}): ParsedMove => ({
  name: "Quickstrike", requiredRoll: 4, cooldown: 1, targetType: "enemy",
  damageModifierPercent: 8, effects: [], rawText: "test move", needsReview: false, ...overrides,
});

const fighter = (id: string, overrides: Partial<Combatant> = {}): Combatant => ({
  instanceId: id, definitionId: id, name: id, image: null, rarity: "Wild", order: "Worldforge", allegiance: "Unbound",
  level: 1, printedPower: 30, printedDefense: 5, printedBaseAttack: 12,
  maxPower: 30, currentPower: 30, defense: 5, baseAttack: 12,
  moves: [move()], cooldowns: {}, activeEffects: [], handlerBonuses: noBonuses(), defeated: false,
  ...overrides,
});

const side = (id: "player" | "ai", mystics: Combatant[], synergies: Record<string, number> = {}): BattleSide => ({ id, name: id, mystics, handlers: [], synergies });

const battle = (playerMystics: Combatant[] = [fighter("p")], aiMystics: Combatant[] = [fighter("a", { order: "Verdant Dawn" })]): BattleState => ({
  id: "test", size: 3, player: side("player", playerMystics), ai: side("ai", aiMystics), currentTurn: "player", turnNumber: 1, winner: null, events: [], lastRoll: null,
});

const statBuff = (stat: "atk" | "def", percent: number, duration: StatusEffect["duration"] = { unit: "turns", count: 1 }): StatusEffect => ({
  id: `test-${stat}-${percent}`, kind: "statModifier", stat, percent, duration, remainingTurns: duration.unit === "turns" ? duration.count : 0, sourceInstanceId: "src", sourceSide: "player", label: "test",
});

describe("level scaling", () => {
  it.each([
    [1, 0], [2, 2], [3, 4], [4, 6], [5, 8], [6, 10], [7, 12], [8, 14], [9, 16], [10, 18],
  ])("level %s applies +%s%%", (level, expectedPercent) => {
    expect(levelBonusPercent(level)).toBe(expectedPercent);
  });

  it("level 10 leveled Base ATK matches the printed formula", () => {
    const printed = 34;
    const leveled = roundHalfUp(printed * (1 + levelBonusPercent(10) / 100));
    expect(leveled).toBe(roundHalfUp(printed * 1.18));
  });
});

describe("damage pipeline", () => {
  it("applies a plain Basic Attack with no modifiers", () => {
    const attacker = fighter("p", { baseAttack: 12 });
    const defender = fighter("a", { defense: 5, order: "Sunspire" }); // no advantage vs Worldforge
    const result = calculateDamage(attacker, defender, null, {});
    expect(result.finalDamage).toBe(7);
    expect(result.advantagePercent).toBe(0);
  });

  it("applies Order Advantage as +25% ATK", () => {
    const attacker = fighter("p", { baseAttack: 12, order: "Worldforge" });
    const defender = fighter("a", { defense: 5, order: "Verdant Dawn" }); // Worldforge is strong against Verdant Dawn
    const result = calculateDamage(attacker, defender, null, {});
    expect(result.advantagePercent).toBe(25);
    expect(result.finalDamage).toBe(10); // round(12*1.25) - 5 = 15 - 5
  });

  it("applies Handler Passive ATK% once, from the resolved handlerBonuses", () => {
    const attacker = fighter("p", { baseAttack: 12, order: "Worldforge", handlerBonuses: { ...noBonuses(), atkPercent: 20 } });
    const defender = fighter("a", { defense: 5, order: "Sunspire" });
    const result = calculateDamage(attacker, defender, null, {});
    expect(result.finalDamage).toBe(9); // round(12*1.20) - 5 = 14 - 5
  });

  it("applies Order Synergy from the attacking side's synergy table", () => {
    const attacker = fighter("p", { baseAttack: 12, order: "Worldforge" });
    const defender = fighter("a", { defense: 5, order: "Sunspire" });
    const result = calculateDamage(attacker, defender, null, { Worldforge: 15 });
    expect(result.synergyPercent).toBe(15);
    expect(result.finalDamage).toBe(9); // round(12*1.15) - 5 = 14 - 5
  });

  it("combines the move's own modifier additively with active ATK buffs at the Move Modifier stage, as one combined multiplier", () => {
    const attacker = fighter("p", {
      baseAttack: 20, order: "Worldforge",
      handlerBonuses: { ...noBonuses(), atkPercent: 10 },
      activeEffects: [statBuff("atk", 20)],
    });
    const defender = fighter("a", { defense: 10, order: "Verdant Dawn" }); // +25% advantage
    const attackMove = move({ damageModifierPercent: 10 });
    const result = calculateDamage(attacker, defender, attackMove, { Worldforge: 15 });
    // 20 * 1.25 (advantage) * 1.10 (handler) * 1.30 (10% move + 20% buff, additive) * 1.15 (synergy) = 41.1125 -> round 41
    // If the move modifier and active buff were instead compounded as separate multiplicative steps
    // (1.10 * 1.20 = 1.32) the result would round to 42 instead — this pins the additive-combination behavior.
    expect(result.finalDamage).toBe(31); // 41 - round(10) = 31
  });

  it("Final Damage is never negative when DEF exceeds ATK", () => {
    const attacker = fighter("p", { baseAttack: 5 });
    const defender = fighter("a", { defense: 50 });
    expect(calculateDamage(attacker, defender, null, {}).finalDamage).toBe(0);
  });

  it("effectiveDefense reflects Handler Passive DEF% and active DEF buffs without mutating state", () => {
    const mystic = fighter("p", { defense: 10, handlerBonuses: { ...noBonuses(), defPercent: 20 }, activeEffects: [statBuff("def", 10)] });
    expect(effectiveDefense(mystic)).toBe(roundHalfUp(10 * 1.2 * 1.1));
    expect(mystic.activeEffects).toHaveLength(1); // untouched
  });

  it("consumes a marked-defense-on-next-hit effect for the specific caster who applied it, reducing effective DEF for that one hit", () => {
    const attacker = fighter("p", { baseAttack: 10, instanceId: "p1" });
    const defender = fighter("a", {
      defense: 20,
      activeEffects: [{ id: "mark", kind: "markDefenseOnNextHit", percent: 50, duration: { unit: "turns", count: 99 }, remainingTurns: 99, sourceInstanceId: "p1", sourceSide: "player", label: "marked" }],
    });
    const first = calculateDamage(attacker, defender, null, {});
    expect(first.finalDamage).toBe(0); // 10 - round(20*0.5)=10 -> 0
    expect(defender.activeEffects).toHaveLength(0); // consumed
    const second = calculateDamage(attacker, defender, null, {});
    expect(second.finalDamage).toBe(0); // mark gone, 10 - 20 clamped to 0
  });

  it("this-attack-only buffs are consumed after contributing to a single damage calc", () => {
    const attacker = fighter("p", { baseAttack: 10, activeEffects: [statBuff("atk", 50, { unit: "thisAttackOnly" })] });
    const defender = fighter("a", { defense: 0 });
    const first = calculateDamage(attacker, defender, null, {});
    expect(first.finalDamage).toBe(15); // 10 * 1.5
    expect(attacker.activeEffects).toHaveLength(0);
    const second = calculateDamage(attacker, defender, null, {});
    expect(second.finalDamage).toBe(10); // buff gone
  });

  it("Untouchable reduces a single hit to 0 damage and is then consumed", () => {
    const attacker = fighter("p", { baseAttack: 999 });
    const defender = fighter("a", { defense: 0, activeEffects: [{ id: "u", kind: "untouchable", percent: 0, duration: { unit: "turns", count: 1 }, remainingTurns: 1, sourceInstanceId: "x", sourceSide: "ai", label: "Untouchable" }] });
    expect(calculateDamage(attacker, defender, null, {}).finalDamage).toBe(0);
    expect(calculateDamage(attacker, defender, null, {}).finalDamage).toBe(999); // consumed, normal damage now
  });
});

describe("D8 rolls", () => {
  it("succeeds at or above the required roll", () => {
    const m = move({ requiredRoll: 5 });
    expect(isMoveSuccessful(m, 4)).toBe(false);
    expect(isMoveSuccessful(m, 5)).toBe(true);
    expect(isMoveSuccessful(m, 8)).toBe(true);
  });
});

describe("cooldowns", () => {
  it("ticks a cooldown down across the owner's own turns and floors at 0", () => {
    const p = fighter("p"); p.cooldowns.Quickstrike = 2;
    const state = battle([p]);
    tickCooldowns(state, state.player);
    expect(p.cooldowns.Quickstrike).toBe(1);
    tickCooldowns(state, state.player);
    expect(p.cooldowns.Quickstrike).toBe(0);
    tickCooldowns(state, state.player);
    expect(p.cooldowns.Quickstrike).toBe(0);
  });

  it("a failed Special Move still applies its cooldown", () => {
    const p = fighter("p", { moves: [move({ requiredRoll: 8, cooldown: 2 })] });
    const state = battle([p]);
    performSpecial(state, "player", "p", "a", 0, { rollD8: () => 1 });
    expect(p.cooldowns.Quickstrike).toBe(2);
  });

  it("a successful Special Move applies its cooldown", () => {
    const p = fighter("p", { moves: [move({ requiredRoll: 2, cooldown: 2 })] });
    const state = battle([p]);
    performSpecial(state, "player", "p", "a", 0, { rollD8: () => 8 });
    expect(p.cooldowns.Quickstrike).toBe(2);
  });

  it("Handler cooldown reduction lowers the applied cooldown but never below its floor", () => {
    const p = fighter("p", { moves: [move({ requiredRoll: 2, cooldown: 2 })], handlerBonuses: { ...noBonuses(), cooldownReductionPerUse: -5, cooldownReductionFloor: 1 } });
    const state = battle([p]);
    performSpecial(state, "player", "p", "a", 0, { rollD8: () => 8 });
    expect(p.cooldowns.Quickstrike).toBe(1); // 2 - 5 clamped to floor 1, not 0 or negative
  });

  it("a cooldownDelta effect can increase an enemy's longest active move cooldown", () => {
    const p = fighter("p", { moves: [move({ requiredRoll: 2, cooldown: 1, effects: [{ kind: "cooldownDelta", subject: "target", scope: "longestActive", amount: 2 }] })] });
    const a = fighter("a", { cooldowns: { Quickstrike: 1 } });
    const state = battle([p], [a]);
    performSpecial(state, "player", "p", "a", 0, { rollD8: () => 8 });
    // 1 (initial) + 2 (cooldownDelta) = 3, then the enemy's own turn immediately starts as part of
    // this same endTurn(), which ticks their cooldowns down by 1 like any other turn boundary -> 2.
    expect(a.cooldowns.Quickstrike).toBe(2);
  });

  it("a cooldownDelta effect can reduce the caster's own other move", () => {
    const other = move({ name: "Other Move", requiredRoll: 6, cooldown: 2 });
    const p = fighter("p", {
      moves: [move({ requiredRoll: 2, cooldown: 1, effects: [{ kind: "cooldownDelta", subject: "self", scope: "otherMove", amount: -1 }] }), other],
      cooldowns: { "Other Move": 2 },
    });
    const state = battle([p]);
    performSpecial(state, "player", "p", "a", 0, { rollD8: () => 8 });
    expect(p.cooldowns["Other Move"]).toBe(1);
  });
});

describe("buff and debuff expiration", () => {
  it("a turns-based buff expires after its counted number of the owner's own turns", () => {
    const p = fighter("p", { activeEffects: [statBuff("atk", 10, { unit: "turns", count: 2 })] });
    const state = battle([p]);
    tickCooldowns(state, state.player);
    expect(p.activeEffects).toHaveLength(1);
    tickCooldowns(state, state.player);
    expect(p.activeEffects).toHaveLength(0);
  });

  it("an untilOwnerNextTurn effect expires the first time the owner's turn ticks", () => {
    const p = fighter("p", { activeEffects: [statBuff("def", 10, { unit: "untilOwnerNextTurn" })] });
    const state = battle([p]);
    tickCooldowns(state, state.player);
    expect(p.activeEffects).toHaveLength(0);
  });

  it("a debuff placed on an enemy ticks down on that enemy's own turns, not the caster's", () => {
    const a = fighter("a", { activeEffects: [statBuff("atk", -10, { unit: "turns", count: 1 })] });
    const state = battle([fighter("p")], [a]);
    tickCooldowns(state, state.player); // player's own turn starting — should not affect the enemy's debuff
    expect(a.activeEffects).toHaveLength(1);
    tickCooldowns(state, state.ai);
    expect(a.activeEffects).toHaveLength(0);
  });
});

describe("Power Score healing and reduction", () => {
  it("heal is clamped to maxPower", () => {
    const p = fighter("p", { maxPower: 30, currentPower: 25, moves: [move({ requiredRoll: 2, cooldown: 1, damageModifierPercent: undefined, targetType: "self", effects: [{ kind: "heal", subject: "self", percent: 50 }] })] });
    const state = battle([p]);
    performSpecial(state, "player", "p", "p", 0, { rollD8: () => 8 });
    expect(p.currentPower).toBe(30);
  });

  it("recoil is clamped to 0 and marks the Mystic defeated", () => {
    const p = fighter("p", { maxPower: 30, currentPower: 5, moves: [move({ requiredRoll: 2, cooldown: 1, damageModifierPercent: undefined, targetType: "self", effects: [{ kind: "recoil", subject: "self", percent: 50 }] })] });
    const state = battle([p]);
    performSpecial(state, "player", "p", "p", 0, { rollD8: () => 8 });
    expect(p.currentPower).toBe(0);
    expect(p.defeated).toBe(true);
  });
});

describe("move success and failure end to end", () => {
  it("a successful special deals damage and ends the turn", () => {
    const p = fighter("p", { baseAttack: 12, moves: [move({ requiredRoll: 3, cooldown: 1, damageModifierPercent: 0 })] });
    const a = fighter("a", { defense: 5 });
    const state = battle([p], [a]);
    const result = performSpecial(state, "player", "p", "a", 0, { rollD8: () => 8 });
    expect(result.success).toBe(true);
    expect(result.damage).toBe(7);
    expect(a.currentPower).toBe(23);
    expect(state.currentTurn).toBe("ai");
  });

  it("a failed special deals no damage but still ends the turn", () => {
    const p = fighter("p", { moves: [move({ requiredRoll: 8, cooldown: 1 })] });
    const a = fighter("a");
    const state = battle([p], [a]);
    const result = performSpecial(state, "player", "p", "a", 0, { rollD8: () => 1 });
    expect(result.success).toBe(false);
    expect(a.currentPower).toBe(a.maxPower);
    expect(state.currentTurn).toBe("ai");
  });
});

describe("effect application (applyEffect via performSpecial)", () => {
  it("applies a self-targeted statModifier buff to the caster", () => {
    const p = fighter("p", { moves: [move({ requiredRoll: 2, cooldown: 1, damageModifierPercent: undefined, targetType: "self", effects: [{ kind: "statModifier", stat: "atk", subject: "self", percent: 15, duration: { unit: "turns", count: 1 } }] })] });
    const state = battle([p]);
    performSpecial(state, "player", "p", "p", 0, { rollD8: () => 8 });
    expect(p.activeEffects).toEqual([expect.objectContaining({ kind: "statModifier", stat: "atk", percent: 15 })]);
  });

  it("applies an allTeam buff to every surviving ally, not the defeated ones", () => {
    const p1 = fighter("p1"); const p2 = fighter("p2"); const p3 = fighter("p3", { currentPower: 0, defeated: true });
    p1.moves = [move({ requiredRoll: 2, cooldown: 1, damageModifierPercent: undefined, targetType: "self", effects: [{ kind: "statModifier", stat: "atk", subject: "allTeam", percent: 8, duration: { unit: "turns", count: 1 } }] })];
    const state = battle([p1, p2, p3]);
    performSpecial(state, "player", "p1", "p1", 0, { rollD8: () => 8 });
    expect(p1.activeEffects).toHaveLength(1);
    expect(p2.activeEffects).toHaveLength(1);
    expect(p3.activeEffects).toHaveLength(0);
  });

  it("applies an allyAuto buff to the surviving ally with the lowest Power percentage, excluding the caster", () => {
    const p1 = fighter("p1", {
      moves: [move({ requiredRoll: 2, cooldown: 1, effects: [{ kind: "statModifier", stat: "def", subject: "allyAuto", percent: 8, duration: { unit: "turns", count: 1 } }] })],
    });
    const p2 = fighter("p2", { currentPower: 25 }); // 25/30
    const p3 = fighter("p3", { currentPower: 10 }); // 10/30, lowest
    const state = battle([p1, p2, p3]);
    performSpecial(state, "player", "p1", "a", 0, { rollD8: () => 8 });
    expect(p2.activeEffects).toHaveLength(0);
    expect(p3.activeEffects).toEqual([expect.objectContaining({ kind: "statModifier", stat: "def", percent: 8 })]);
  });

  it("a retaliateAtkDebuff triggers once when the caster is next hit, debuffing the attacker", () => {
    const p = fighter("p", { moves: [move({ requiredRoll: 2, cooldown: 1, damageModifierPercent: undefined, targetType: "self", effects: [{ kind: "retaliateAtkDebuff", subject: "self", percent: 25 }] })] });
    const a = fighter("a");
    const state = battle([p], [a]);
    performSpecial(state, "player", "p", "p", 0, { rollD8: () => 8 });
    expect(p.activeEffects).toEqual([expect.objectContaining({ kind: "retaliateAtkDebuff", percent: 25 })]);
    state.currentTurn = "ai";
    performBasicAttack(state, "ai", "a", "p");
    expect(p.activeEffects).toHaveLength(0); // consumed
    expect(a.activeEffects).toEqual([expect.objectContaining({ kind: "statModifier", stat: "atk", percent: -25 })]);
  });

  it("a chanceRecoilSplash at 100% always applies recoil to a random surviving ally", () => {
    const p1 = fighter("p1", { moves: [move({ requiredRoll: 2, cooldown: 1, damageModifierPercent: 100, effects: [{ kind: "chanceRecoilSplash", chancePercent: 100, percentOfDamageDealt: 50 }] })] });
    const p2 = fighter("p2", { maxPower: 30, currentPower: 30 });
    const a = fighter("a", { defense: 0 });
    const state = battle([p1, p2], [a]);
    performSpecial(state, "player", "p1", "a", 0, { rollD8: () => 8 });
    expect(p2.currentPower).toBeLessThan(30);
  });
});

describe("defeated Mystics and victory", () => {
  it("a Basic Attack cannot target an already-defeated Mystic", () => {
    const state = battle([fighter("p")], [fighter("a", { currentPower: 0, defeated: true })]);
    expect(() => performBasicAttack(state, "player", "p", "a")).toThrow();
  });

  it("checkVictory declares the player winner once every enemy Mystic is defeated", () => {
    const state = battle([fighter("p")], [fighter("a", { currentPower: 0, defeated: true })]);
    expect(checkVictory(state)).toBe("player");
  });

  it("endTurn stops alternating turns once a winner is set", () => {
    const state = battle([fighter("p")], [fighter("a", { currentPower: 0, defeated: true })]);
    endTurn(state);
    expect(state.winner).toBe("player");
    expect(state.currentTurn).toBe("player"); // unchanged, no further turn flip
  });
});
