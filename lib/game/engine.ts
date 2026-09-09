import type { BattleEvent, BattleSide, BattleState, Combatant, EffectSpec, ParsedMove, StatusEffect } from "./types";
import { orderAdvantagePercent } from "./order-matchups";
import { roundHalfUp } from "./rounding";

export type Dice = { rollD8(): number };
export const randomDice: Dice = { rollD8: () => Math.floor(Math.random() * 8) + 1 };

export function isMoveSuccessful(move: ParsedMove, roll: number) {
  return roll >= move.requiredRoll;
}

// ---------------------------------------------------------------------------
// Status effect bookkeeping
// ---------------------------------------------------------------------------

const statEffects = (mystic: Combatant, stat: "atk" | "def") =>
  mystic.activeEffects.filter((effect) => effect.kind === "statModifier" && effect.stat === stat);

export const sumStatPercent = (mystic: Combatant, stat: "atk" | "def") => statEffects(mystic, stat).reduce((total, effect) => total + effect.percent, 0);

/** Read-only equivalent of the "Enemy Effective DEF" pipeline stage, for UI display — never consumes one-shot effects. */
export function effectiveDefense(mystic: Combatant) {
  return roundHalfUp(mystic.defense * (1 + mystic.handlerBonuses.defPercent / 100) * (1 + sumStatPercent(mystic, "def") / 100));
}

/** Read-only preview of what calculateDamage would deal right now — used by the UI for the pre-roll damage estimate. Never mutates state or consumes one-shot effects (marks, "this attack only" buffs), so it can be called freely while the player is still choosing an action. */
export function previewDamage(attacker: Combatant, defender: Combatant, move: ParsedMove | null, attackerSynergies: Record<string, number>) {
  let atk = attacker.baseAttack;
  const advantagePercent = orderAdvantagePercent(attacker.order, defender.order);
  atk *= 1 + advantagePercent / 100;
  atk *= 1 + attacker.handlerBonuses.atkPercent / 100;
  const moveModifierPercent = (move?.damageModifierPercent ?? 0) + sumStatPercent(attacker, "atk");
  atk *= 1 + moveModifierPercent / 100;
  const synergyPercent = attackerSynergies[attacker.order] ?? 0;
  atk *= 1 + synergyPercent / 100;
  const def = effectiveDefense(defender);
  return { finalDamage: Math.max(0, roundHalfUp(atk) - def), advantagePercent, synergyPercent };
}

/** "This attack only" buffs are consumed the instant they contribute to a damage calc, regardless of which move originally granted them. */
function consumeThisAttackOnlyEffects(mystic: Combatant) {
  mystic.activeEffects = mystic.activeEffects.filter((effect) => effect.duration.unit !== "thisAttackOnly");
}

function consumeMarkedDefense(defender: Combatant, attackerInstanceId: string): number {
  const mark = defender.activeEffects.find((effect) => effect.kind === "markDefenseOnNextHit" && effect.sourceInstanceId === attackerInstanceId);
  if (!mark) return 0;
  defender.activeEffects = defender.activeEffects.filter((effect) => effect !== mark);
  return mark.percent;
}

function consumeUntouchable(defender: Combatant): boolean {
  const effect = defender.activeEffects.find((e) => e.kind === "untouchable");
  if (!effect) return false;
  defender.activeEffects = defender.activeEffects.filter((e) => e !== effect);
  return true;
}

/** Whichever enemy just landed a hit takes the debuff, and the pending retaliate effect on the defender is consumed. */
function consumeRetaliate(defender: Combatant, attacker: Combatant, turnNumber: number, sourceSide: "player" | "ai") {
  const effect = defender.activeEffects.find((e) => e.kind === "retaliateAtkDebuff");
  if (!effect) return null;
  defender.activeEffects = defender.activeEffects.filter((e) => e !== effect);
  const debuff: StatusEffect = { id: `retaliate-${turnNumber}-${attacker.instanceId}`, kind: "statModifier", stat: "atk", percent: -effect.percent, duration: { unit: "turns", count: 1 }, remainingTurns: 1, sourceInstanceId: defender.instanceId, sourceSide, label: `${defender.name} retaliated` };
  attacker.activeEffects.push(debuff);
  return debuff;
}

// ---------------------------------------------------------------------------
// Damage pipeline — locked order: Leveled Base ATK -> Order Advantage -> Handler
// Passive -> Move Modifier -> Order Synergy -> Enemy Effective DEF -> Final Damage.
// ---------------------------------------------------------------------------

export function calculateDamage(attacker: Combatant, defender: Combatant, move: ParsedMove | null, attackerSynergies: Record<string, number>) {
  let atk = attacker.baseAttack; // 1. Leveled Base ATK
  const advantagePercent = orderAdvantagePercent(attacker.order, defender.order); // 2. Order Advantage
  atk *= 1 + advantagePercent / 100;
  atk *= 1 + attacker.handlerBonuses.atkPercent / 100; // 3. Handler Passive
  const moveModifierPercent = (move?.damageModifierPercent ?? 0) + sumStatPercent(attacker, "atk"); // 4. Move Modifier + any active ATK buffs/debuffs
  atk *= 1 + moveModifierPercent / 100;
  const synergyPercent = attackerSynergies[attacker.order] ?? 0; // 5. Order Synergy
  atk *= 1 + synergyPercent / 100;
  consumeThisAttackOnlyEffects(attacker);

  let def = defender.defense; // 6. Enemy Effective DEF
  def *= 1 + defender.handlerBonuses.defPercent / 100;
  def *= 1 + sumStatPercent(defender, "def") / 100;
  const markPercent = consumeMarkedDefense(defender, attacker.instanceId);
  if (markPercent) def *= 1 - markPercent / 100;

  const untouchable = consumeUntouchable(defender);
  const finalDamage = untouchable ? 0 : Math.max(0, roundHalfUp(atk) - roundHalfUp(def)); // 7. Final Damage
  return { finalDamage, advantagePercent, synergyPercent, untouchable };
}

function applyDamage(defender: Combatant, amount: number) {
  defender.currentPower = Math.max(0, defender.currentPower - amount);
  defender.defeated = defender.currentPower <= 0;
}

// ---------------------------------------------------------------------------
// Effect application
// ---------------------------------------------------------------------------

function lowestPowerAlly(side: BattleSide, excludeInstanceId: string): Combatant | undefined {
  return side.mystics.filter((m) => !m.defeated && m.instanceId !== excludeInstanceId).sort((a, b) => a.currentPower / a.maxPower - b.currentPower / b.maxPower)[0];
}

function longestActiveCooldownMove(mystic: Combatant): string | undefined {
  const entries = Object.entries(mystic.cooldowns).filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]);
  return entries[0]?.[0];
}

function adjustCooldown(mystic: Combatant, moveName: string, amount: number) {
  mystic.cooldowns[moveName] = Math.max(0, (mystic.cooldowns[moveName] ?? 0) + amount);
}

type EffectContext = {
  state: BattleState;
  casterSide: BattleSide;
  opponentSide: BattleSide;
  caster: Combatant;
  target: Combatant; // the resolved enemy or ally target for "target"-subject effects
  sourceSide: "player" | "ai";
  moveName: string;
  damageDealt: number;
};

function applyEffect(ctx: EffectContext, spec: EffectSpec) {
  const { state, casterSide, opponentSide, caster, target, sourceSide } = ctx;
  const log = (type: BattleEvent["type"], message: string) => state.events.push(event(state, type, message));
  const newEffect = (partial: Omit<StatusEffect, "id" | "sourceInstanceId" | "sourceSide">, on: Combatant): StatusEffect => ({
    id: `fx-${state.turnNumber}-${on.instanceId}-${Math.random().toString(36).slice(2, 7)}`,
    sourceInstanceId: caster.instanceId,
    sourceSide,
    ...partial,
  });

  const recipients = (subject: import("./types").EffectSubject) => {
    if (subject === "allTeam") return casterSide.mystics.filter(m => !m.defeated);
    if (subject === "allEnemies") return opponentSide.mystics.filter(m => !m.defeated);
    if (subject === "allyAuto") { const ally = lowestPowerAlly(casterSide, caster.instanceId); return ally ? [ally] : []; }
    return [subject === "self" ? caster : target];
  };
  switch (spec.kind) {
    case "statModifier": {
      const label = `${spec.stat.toUpperCase()} ${spec.percent > 0 ? "+" : ""}${spec.percent}%`;
      const applyTo = (on: Combatant) => { if (spec.stat === "def" && spec.percent > 0 && on.activeEffects.some(effect => effect.kind === "blockDefenseBuff")) { log("system", `${on.name} cannot receive new DEF buffs.`); return; } on.activeEffects.push(newEffect({ kind: "statModifier", stat: spec.stat, percent: spec.percent, duration: spec.duration, remainingTurns: spec.duration.unit === "turns" ? spec.duration.count : 0, label }, on)); log(spec.percent >= 0 ? "buff" : "debuff", `${on.name} ${spec.percent >= 0 ? "gains" : "suffers"} ${label}.`); };
      if (spec.subject === "self") applyTo(caster);
      else if (spec.subject === "target") applyTo(target);
      else if (spec.subject === "allTeam" || spec.subject === "allEnemies") recipients(spec.subject).forEach(applyTo);
      else if (spec.subject === "allyAuto") { const ally = lowestPowerAlly(casterSide, caster.instanceId); if (ally) applyTo(ally); else log("system", `${caster.name} had no other ally to buff.`); }
      break;
    }
    case "heal": {
      const before = caster.currentPower;
      caster.currentPower = Math.min(caster.maxPower, caster.currentPower + roundHalfUp(caster.maxPower * spec.percent / 100));
      log("heal", `${caster.name} recovered ${caster.currentPower - before} Power.`);
      break;
    }
    case "recoil": {
      const amount = roundHalfUp(caster.maxPower * spec.percent / 100);
      applyDamage(caster, amount);
      log("damage", `${caster.name} lost ${amount} Power from recoil.`);
      break;
    }
    case "powerChange": {
      for (const on of recipients(spec.subject)) {
        const amount = spec.amount ?? roundHalfUp((spec.basis === "current" ? on.currentPower : on.maxPower) * (spec.percent ?? 0) / 100);
        const before = on.currentPower;
        if (spec.healing) on.currentPower = Math.min(on.maxPower, on.currentPower + amount);
        else applyDamage(on, amount);
        log(spec.healing ? "heal" : "damage", `${on.name} ${spec.healing ? "recovered" : "lost"} ${Math.abs(on.currentPower - before)} Power.`);
      }
      break;
    }
    case "cooldownDelta": {
      for (const on of recipients(spec.subject).filter(on => !spec.order || on.order === spec.order)) {
        if (spec.scope === "bothMoves" || spec.scope === "allActive") on.moves.filter(move => spec.scope === "bothMoves" || (on.cooldowns[move.name] ?? 0) > 0).forEach(move => adjustCooldown(on, move.name, spec.amount));
        else if (spec.scope === "otherMove") { const other = on.moves.find(move => move.name !== ctx.moveName); if (other) adjustCooldown(on, other.name, spec.amount); }
        else { const name = longestActiveCooldownMove(on); if (name) adjustCooldown(on, name, spec.amount); else continue; }
        log("cooldown", `${on.name}'s Special Move recovery changed by ${spec.amount > 0 ? "+" : ""}${spec.amount} turn(s).`);
      }
      break;
    }
    case "blockDefenseBuff": {
      target.activeEffects.push(newEffect({ kind: spec.kind, percent: 0, duration: spec.duration, remainingTurns: 0, label: "Cannot gain DEF buffs" }, target));
      log("debuff", `${target.name} cannot receive new DEF buffs.`);
      break;
    }
    case "markDefenseOnNextHit":
      target.activeEffects.push(newEffect({ kind: "markDefenseOnNextHit", percent: spec.percent, duration: { unit: "turns", count: 99 }, remainingTurns: 99, label: `Marked -${spec.percent}% DEF` }, target));
      log("debuff", `${target.name} is marked, taking -${spec.percent}% DEF on the next hit from ${caster.name}.`);
      break;
    case "retaliateAtkDebuff":
      caster.activeEffects.push(newEffect({ kind: "retaliateAtkDebuff", percent: spec.percent, duration: { unit: "turns", count: 99 }, remainingTurns: 99, label: `Retaliates -${spec.percent}% ATK` }, caster));
      break;
    case "silence": case "stun": case "untouchable": {
      const on = spec.subject === "self" ? caster : target;
      on.activeEffects.push(newEffect({ kind: spec.kind, percent: 0, duration: spec.duration, remainingTurns: spec.duration.unit === "turns" ? spec.duration.count : 0, label: spec.kind }, on));
      log("debuff", `${on.name} is ${spec.kind === "untouchable" ? "Untouchable" : spec.kind === "silence" ? "Silenced" : "Stunned"}.`);
      break;
    }
    case "regen": case "dot": {
      const on = spec.subject === "self" ? caster : target;
      on.activeEffects.push(newEffect({ kind: spec.kind, percent: spec.percent, duration: spec.duration, remainingTurns: spec.duration.unit === "turns" ? spec.duration.count : 0, label: spec.kind === "regen" ? `Regeneration ${spec.percent}%` : `${spec.percent}% burn` }, on));
      break;
    }
    case "chanceRecoilSplash": {
      if (Math.random() * 100 > spec.chancePercent) break;
      const ally = lowestPowerAlly(casterSide, caster.instanceId) ?? casterSide.mystics.find((m) => !m.defeated && m.instanceId !== caster.instanceId);
      if (!ally) break;
      const amount = roundHalfUp(ctx.damageDealt * spec.percentOfDamageDealt / 100);
      applyDamage(ally, amount);
      log("damage", `${ally.name} lost ${amount} Power from ${caster.name}'s backlash.`);
      break;
    }
  }
  void opponentSide;
}

// ---------------------------------------------------------------------------
// Per-turn regen/dot ticks (applied at the owner's own turn start, alongside cooldown ticks)
// ---------------------------------------------------------------------------

function applyPerTurnEffects(state: BattleState, mystic: Combatant) {
  for (const effect of mystic.activeEffects) {
    if (effect.kind === "regen") { const before = mystic.currentPower; mystic.currentPower = Math.min(mystic.maxPower, mystic.currentPower + roundHalfUp(mystic.maxPower * effect.percent / 100)); if (mystic.currentPower !== before) state.events.push(event(state, "heal", `${mystic.name} regenerated ${mystic.currentPower - before} Power.`)); }
    if (effect.kind === "dot") { const amount = roundHalfUp(mystic.maxPower * effect.percent / 100); applyDamage(mystic, amount); state.events.push(event(state, "damage", `${mystic.name} took ${amount} Power from a lingering effect.`)); }
  }
}

export function tickCooldowns(state: BattleState, side: BattleSide) {
  for (const mystic of [...state.player.mystics, ...state.ai.mystics]) mystic.activeEffects = mystic.activeEffects.filter(effect => effect.duration.unit !== "untilSourceNextTurn" || effect.sourceSide !== side.id);
  for (const mystic of side.mystics) {
    for (const key of Object.keys(mystic.cooldowns)) mystic.cooldowns[key] = Math.max(0, mystic.cooldowns[key] - 1);
    applyPerTurnEffects(state, mystic);
    mystic.activeEffects = mystic.activeEffects.filter((effect) => {
      if (effect.duration.unit === "untilOwnerNextTurn") return false;
      if (effect.duration.unit === "turns") { effect.remainingTurns -= 1; return effect.remainingTurns > 0; }
      return true; // thisAttackOnly/markDefenseOnNextHit/retaliateAtkDebuff expire only when consumed, not on a timer
    });
  }
}

export function checkVictory(state: BattleState) {
  if (state.ai.mystics.every((m) => m.defeated)) state.winner = "player";
  if (state.player.mystics.every((m) => m.defeated)) state.winner = "ai";
  return state.winner;
}

const event = (state: BattleState, type: BattleEvent["type"], message: string, data?: BattleEvent["data"]): BattleEvent => ({
  id: `${state.turnNumber}-${state.events.length}-${Math.random().toString(36).slice(2, 7)}`,
  turn: state.turnNumber,
  type,
  message,
  data,
});

function applyHandlerCooldown(mystic: Combatant, moveName: string, baseCooldown: number) {
  const reduced = baseCooldown + mystic.handlerBonuses.cooldownReductionPerUse;
  mystic.cooldowns[moveName] = Math.max(mystic.handlerBonuses.cooldownReductionFloor, reduced, 0);
}

function resolveAndApplyEffects(state: BattleState, casterSide: BattleSide, opponentSide: BattleSide, caster: Combatant, target: Combatant, sourceSide: "player" | "ai", move: ParsedMove, damageDealt: number) {
  const ctx: EffectContext = { state, casterSide, opponentSide, caster, target, sourceSide, moveName: move.name, damageDealt };
  for (const spec of move.effects) applyEffect(ctx, spec);
}

export function performBasicAttack(state: BattleState, sideId: "player" | "ai", attackerId: string, defenderId: string) {
  const side = state[sideId];
  const opponent = state[sideId === "player" ? "ai" : "player"];
  const attacker = side.mystics.find((m) => m.instanceId === attackerId);
  const defender = opponent.mystics.find((m) => m.instanceId === defenderId);
  if (!attacker || !defender || attacker.defeated || defender.defeated || state.currentTurn !== sideId || state.winner) throw new Error("Invalid attack");
  const { finalDamage, advantagePercent, untouchable } = calculateDamage(attacker, defender, null, side.synergies);
  if (advantagePercent) state.events.push(event(state, "advantage", `${attacker.order} has Order Advantage against ${defender.order}: +${advantagePercent}% ATK.`));
  applyDamage(defender, finalDamage);
  state.events.push(event(state, "attack", `${attacker.name} made a Basic Attack.`, { actorId: attackerId, targetId: defenderId, untouchable }));
  state.events.push(event(state, "damage", untouchable ? `${defender.name} was Untouchable — 0 damage taken.` : `${attacker.name} dealt ${finalDamage} damage to ${defender.name}.`, { damage: finalDamage }));
  consumeRetaliate(defender, attacker, state.turnNumber, sideId);
  if (defender.defeated) state.events.push(event(state, "ko", `${defender.name} was defeated.`));
  endTurn(state);
  return { finalDamage };
}

export function performSpecial(state: BattleState, sideId: "player" | "ai", attackerId: string, defenderId: string, moveIndex: number, dice: Dice = randomDice) {
  const side = state[sideId];
  const opponent = state[sideId === "player" ? "ai" : "player"];
  const attacker = side.mystics.find((m) => m.instanceId === attackerId);
  const defender = opponent.mystics.find((m) => m.instanceId === defenderId) ?? side.mystics.find((m) => m.instanceId === defenderId);
  if (!attacker || !defender || attacker.defeated || defender.defeated || state.currentTurn !== sideId || state.winner) throw new Error("Invalid special");
  const move = attacker.moves[moveIndex];
  if (!move || (attacker.cooldowns[move.name] ?? 0) > 0) throw new Error("Move is on cooldown");
  if (attacker.activeEffects.some((e) => e.kind === "silence")) throw new Error("Special Moves are silenced");

  if (move.targetType === "ally" && !side.mystics.includes(defender)) throw new Error("Choose an allied Mystic");
  if (move.targetType === "enemy" && !opponent.mystics.includes(defender)) throw new Error("Choose an enemy Mystic");
  const roll = dice.rollD8();
  state.lastRoll = roll;
  state.events.push(event(state, "special", `${attacker.name} used ${move.name}.`, { actorId: attackerId, targetId: defenderId, moveIndex }));
  state.events.push(event(state, "roll", `Rolled ${roll} (needs ${move.requiredRoll}+).`, { roll }));
  applyHandlerCooldown(attacker, move.name, move.cooldown);

  if (!isMoveSuccessful(move, roll)) {
    state.events.push(event(state, "special", `${move.name} failed.`, { success: false }));
    endTurn(state);
    return { success: false, damage: 0, roll };
  }

  const enemyTarget = move.targetType === "self" ? attacker : defender; // "target"-subject effects on a self-only move never fire (data-verified), so this is never read in that case
  let finalDamage = 0;
  if (move.targetType === "enemy") {
    const result = calculateDamage(attacker, defender, move, side.synergies);
    finalDamage = result.finalDamage;
    if (result.advantagePercent) state.events.push(event(state, "advantage", `${attacker.order} has Order Advantage against ${defender.order}: +${result.advantagePercent}% ATK.`));
    if (result.synergyPercent) state.events.push(event(state, "synergy", `${attacker.order} Order Synergy: +${result.synergyPercent}% ATK.`));
    applyDamage(defender, finalDamage);
    state.events.push(event(state, "damage", result.untouchable ? `${defender.name} was Untouchable — 0 damage taken.` : `${attacker.name} dealt ${finalDamage} damage to ${defender.name}.`, { damage: finalDamage }));
    consumeRetaliate(defender, attacker, state.turnNumber, sideId);
  }

  resolveAndApplyEffects(state, side, opponent, attacker, enemyTarget, sideId, move, finalDamage);
  state.events.push(event(state, "special", `${move.name} succeeded with a roll of ${roll}.`, { success: true }));
  if (defender.defeated) state.events.push(event(state, "ko", `${defender.name} was defeated.`));
  endTurn(state);
  return { success: true, damage: finalDamage, roll };
}

export function endTurn(state: BattleState) {
  if (checkVictory(state)) {
    state.events.push(event(state, "victory", `${state[state.winner!].name} won the match.`));
    return;
  }
  state.currentTurn = state.currentTurn === "player" ? "ai" : "player";
  state.turnNumber += 1;
  tickCooldowns(state, state[state.currentTurn]);
}

export function rollStartingPlayer(dice: Dice = randomDice): { player: number; ai: number; first: "player" | "ai" } {
  let player = dice.rollD8();
  let ai = dice.rollD8();
  while (player === ai) { player = dice.rollD8(); ai = dice.rollD8(); }
  return { player, ai, first: player > ai ? "player" : "ai" };
}
