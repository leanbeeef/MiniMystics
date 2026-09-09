import { describe, expect, it } from "vitest";
import { ALL_CAMPAIGN_STAGES, catalog, createBattle, initialState } from "../client-state";
import { performBasicAttack, performSpecial } from "../game/engine";
import { battlePresentation } from "./battle-events";
const setup = () => {
  const state = structuredClone(initialState);
  state.ownedCards = catalog.mystics.slice(0, 3).map((mystic, index) => ({ id: `test-${index}`, definitionId: mystic.id, acquiredAt: "", level: 1 }));
  createBattle(state, ALL_CAMPAIGN_STAGES.find((stage) => stage.size === 3)!.id);
  state.battle!.currentTurn = "player";
  return state.battle!;
};
describe("battle presentation adapter", () => {
  it("uses instance IDs even for duplicate names and leaves committed combat untouched", () => {
    const battle = setup(); const actor = battle.player.mystics[0]; const target = battle.ai.mystics[0];
    battle.ai.mystics[1].name = actor.name;
    const before = structuredClone(battle);
    performBasicAttack(battle, "player", actor.instanceId, target.instanceId);
    const committed = structuredClone(battle);
    const action = battlePresentation(before, battle)!;
    expect(action.actor?.instanceId).toBe(actor.instanceId);
    expect(action.target?.instanceId).toBe(target.instanceId);
    expect(action.failed).toBe(false);
    expect(battle).toEqual(committed);
    expect(battlePresentation(battle, battle)).toBeNull();
  });
  it("reports failed activation without successful damage, heal or buff feedback", () => {
    const battle = setup(); const actor = battle.player.mystics[0]; const target = battle.ai.mystics[0];
    actor.moves[0] = { ...actor.moves[0], requiredRoll: 8 };
    const before = structuredClone(battle);
    performSpecial(battle, "player", actor.instanceId, target.instanceId, 0, { rollD8: () => 1 });
    const action = battlePresentation(before, battle)!;
    expect(action.failed).toBe(true);
    expect(action.roll).toEqual({ face: 1, required: 8 });
    expect(action.feedback).toContainEqual({ targetId: actor.instanceId, kind: "failed", text: "FAILED" });
    expect(action.feedback.some((item) => ["damage", "heal", "buff"].includes(item.kind))).toBe(false);
    expect(battle.currentTurn).toBe("ai");
  });
  it("preserves defeat logic while exposing final damage and defeat feedback", () => {
    const battle = setup(); const actor = battle.player.mystics[0]; const target = battle.ai.mystics[0];
    actor.baseAttack = 10000; target.currentPower = 1;
    const before = structuredClone(battle);
    performBasicAttack(battle, "player", actor.instanceId, target.instanceId);
    const action = battlePresentation(before, battle)!;
    expect(target.defeated).toBe(true);
    expect(action.feedback).toContainEqual({ targetId: target.instanceId, kind: "damage", text: "−1" });
    expect(action.feedback).toContainEqual({ targetId: target.instanceId, kind: "defeat", text: "DEFEATED" });
  });
});
