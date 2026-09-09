import type { BattleState, Combatant } from "../game/types";
export type FeedbackKind = "damage" | "heal" | "shield" | "buff" | "debuff" | "cooldown" | "miss" | "failed" | "advantage" | "defeat";
export type CombatFeedback = { targetId: string; kind: FeedbackKind; text: string };
export type PresentationAction = { actor?: Combatant; target?: Combatant; special: boolean; failed: boolean; miss: boolean; advantage: boolean; name: string; roll?: { face: number; required: number }; feedback: CombatFeedback[]; durationKind: "basic" | "special" | "apex" };
export const combatants = (battle: BattleState) => [...battle.player.mystics, ...battle.ai.mystics];
/** Reads a committed battle snapshot; never calculates damage or changes game state. */
export function battlePresentation(before: BattleState, after: BattleState): PresentationAction | null {
  if (before.id !== after.id) return null;
  const seen = new Set(before.events.map((event) => event.id));
  const events = after.events.filter((event) => !seen.has(event.id));
  if (!events.length) return null;
  const action = events.find((event) => (event.type === "attack" || event.type === "special") && typeof event.data?.actorId === "string");
  const roster = combatants(after);
  const actor = roster.find((mystic) => mystic.instanceId === action?.data?.actorId);
  const target = roster.find((mystic) => mystic.instanceId === action?.data?.targetId);
  const special = action?.type === "special";
  const failed = events.some((event) => event.type === "special" && event.data?.success === false);
  const miss = !failed && (action?.data?.untouchable === true || events.some((event) => event.type === "damage" && event.message.includes("Untouchable")));
  const advantage = events.some((event) => event.type === "advantage");
  const feedback: CombatFeedback[] = [];
  for (const mystic of roster) {
    const previous = combatants(before).find((entry) => entry.instanceId === mystic.instanceId);
    if (!previous) continue;
    const delta = mystic.currentPower - previous.currentPower;
    if (delta) feedback.push({ targetId: mystic.instanceId, kind: delta > 0 ? "heal" : "damage", text: `${delta > 0 ? "+" : "−"}${Math.abs(delta)}` });
    for (const effect of mystic.activeEffects.filter((entry) => !previous.activeEffects.some((old) => old.id === entry.id))) {
      const shield = effect.kind === "untouchable";
      const negative = effect.percent < 0 || ["silence", "stun", "dot", "markDefenseOnNextHit"].includes(effect.kind);
      feedback.push({ targetId: mystic.instanceId, kind: shield ? "shield" : negative ? "debuff" : "buff", text: shield ? "◇ UNTOUCHABLE" : effect.stat ? `${effect.percent >= 0 ? "+" : ""}${effect.percent}% ${effect.stat.toUpperCase()}` : effect.kind.toUpperCase() });
    }
    const reduction = Object.entries(previous.cooldowns).reduce((sum, [name, value]) => sum + Math.max(0, value - (mystic.cooldowns[name] ?? 0)), 0);
    if (reduction > 0) feedback.push({ targetId: mystic.instanceId, kind: "cooldown", text: `↻ RECOVERY −${reduction}` });
    if (!previous.defeated && mystic.defeated) feedback.push({ targetId: mystic.instanceId, kind: "defeat", text: "DEFEATED" });
  }
  if (failed && actor) feedback.push({ targetId: actor.instanceId, kind: "failed", text: "FAILED" });
  if (miss && target) feedback.push({ targetId: target.instanceId, kind: "miss", text: "MISS · UNTOUCHABLE" });
  if (advantage && actor) feedback.push({ targetId: actor.instanceId, kind: "advantage", text: "✦ ORDER ADVANTAGE" });
  const move = actor?.moves[Number(action?.data?.moveIndex)];
  const face = events.find((event) => event.type === "roll")?.data?.roll;
  const roll = special && move && typeof face === "number" ? { face, required: move.requiredRoll } : undefined;
  return { actor, target, special, failed, miss, advantage, roll, name: special ? move?.name ?? "Special Move" : "Basic Attack", feedback, durationKind: special ? actor?.rarity === "Apex" ? "apex" : "special" : "basic" };
}
