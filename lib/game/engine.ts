import type { BattleEvent, BattleSide, BattleState, Combatant, ParsedMove } from "./types";

export type Dice = { rollD6(): number };
export const randomDice: Dice = { rollD6: () => Math.floor(Math.random() * 6) + 1 };

export const calculateDamage = (attack: number, defense: number) => Math.max(1, attack - defense);
export const canUseHandler = (uses: number, maxUses: number) => uses < maxUses;

export function resolveAttack(attacker: Combatant, defender: Combatant, attackValue = attacker.baseAttack, hits = 1) {
  const defense = Math.max(0, defender.defense + defender.effects.filter((e) => e.kind === "defense").reduce((a, e) => a + e.value, 0));
  const marked = defender.effects.find((e) => e.kind === "marked");
  const evade = defender.effects.find((e) => e.kind === "evade");
  if (evade) {
    defender.effects = defender.effects.filter((e) => e.id !== evade.id);
    return { totalDamage: 0, damagePerHit: [0], defense, evaded: true };
  }
  const damagePerHit = Array.from({ length: hits }, () => calculateDamage(attackValue, defense));
  let totalDamage = damagePerHit.reduce((a, b) => a + b, 0);
  if (marked) {
    totalDamage += marked.value;
    defender.effects = defender.effects.filter((e) => e.id !== marked.id);
  }
  defender.currentPower = Math.max(0, defender.currentPower - totalDamage);
  defender.defeated = defender.currentPower <= 0;
  return { totalDamage, damagePerHit, defense, evaded: false };
}

export function isMoveSuccessful(move: ParsedMove, roll: number) {
  return move.exactRoll ? roll === move.exactRoll : roll >= (move.minimumRoll ?? move.requiredRoll);
}

export function tickCooldowns(side: BattleSide) {
  for (const mystic of side.mystics) {
    for (const key of Object.keys(mystic.cooldowns)) mystic.cooldowns[key] = Math.max(0, mystic.cooldowns[key] - 1);
    mystic.effects = mystic.effects.filter((effect) => !(effect.expiresAt === "ownerTurnStart" || (effect.expiresAt === "sourceTurnStart" && effect.sourceSide === side.id)));
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

export function performBasicAttack(state: BattleState, sideId: "player" | "ai", attackerId: string, defenderId: string) {
  const side = state[sideId];
  const opponent = state[sideId === "player" ? "ai" : "player"];
  const attacker = side.mystics.find((m) => m.instanceId === attackerId);
  const defender = opponent.mystics.find((m) => m.instanceId === defenderId);
  if (!attacker || !defender || attacker.defeated || defender.defeated || state.currentTurn !== sideId || state.winner) throw new Error("Invalid attack");
  const attackBonus = attacker.effects.filter((e) => e.kind === "attack").reduce((a, e) => a + e.value, 0);
  const attack = attacker.baseAttack + attackBonus;
  const result = resolveAttack(attacker, defender, attack);
  attacker.effects = attacker.effects.filter((e) => !(e.kind === "attack" && e.expiresAt === "onAttack"));
  state.events.push(event(state, "attack", `${attacker.name} made a Basic Attack.`, { attack }));
  state.events.push(event(state, "damage", result.evaded ? `${defender.name} evaded the attack.` : `${result.totalDamage} damage dealt to ${defender.name}.`, { damage: result.totalDamage, defense: result.defense }));
  if (defender.defeated) state.events.push(event(state, "ko", `${defender.name} was defeated.`));
  endTurn(state);
  return result;
}

export function performSpecial(state: BattleState, sideId: "player" | "ai", attackerId: string, defenderId: string, moveIndex: number, dice: Dice = randomDice) {
  const side = state[sideId];
  const opponent = state[sideId === "player" ? "ai" : "player"];
  const attacker = side.mystics.find((m) => m.instanceId === attackerId);
  const defender = opponent.mystics.find((m) => m.instanceId === defenderId);
  if (!attacker || !defender || attacker.defeated || defender.defeated || state.currentTurn !== sideId || state.winner) throw new Error("Invalid special");
  const move = attacker.moves[moveIndex];
  if (!move || (attacker.cooldowns[move.name] ?? 0) > 0) throw new Error("Move is on cooldown");
  if (attacker.effects.some((e) => e.kind === "specialLock")) throw new Error("Special Moves are locked");
  let roll = dice.rollD6();
  state.lastRoll = roll;
  attacker.cooldowns[move.name] = move.cooldown + 1;
  state.events.push(event(state, "special", `${attacker.name} used ${move.name}.`));
  state.events.push(event(state, "roll", `Rolled ${roll}.`, { roll }));
  if (!isMoveSuccessful(move, roll)) {
    const reroll = attacker.effects.find((effect) => effect.kind === "reroll");
    if (reroll) {
      attacker.effects = attacker.effects.filter((effect) => effect.id !== reroll.id);
      roll = dice.rollD6();
      state.lastRoll = roll;
      state.events.push(event(state, "roll", `Lucky Break reroll: ${roll}.`, { roll, reroll: true }));
    }
  }
  if (!isMoveSuccessful(move, roll)) {
    state.events.push(event(state, "special", `${move.name} failed. Cooldown set to ${move.cooldown}.`, { success: false, cooldown: move.cooldown }));
    endTurn(state);
    return { success: false, damage: 0, roll };
  }
  const attackBonus = attacker.effects.filter((e) => e.kind === "attack").reduce((a, e) => a + e.value, 0);
  const attack = (attacker.baseAttack * (move.attackMultiplier ?? 1)) + (move.attackModifier ?? 0) + attackBonus;
  let damage = 0;
  if (move.attackModifier || move.multiHitCount || move.attackMultiplier || move.ignoreDefense) {
    const originalDefense = defender.defense;
    if (move.ignoreDefense) defender.defense = 0;
    const result = resolveAttack(attacker, defender, attack, move.multiHitCount ?? 1);
    defender.defense = originalDefense;
    damage = result.totalDamage;
    state.events.push(event(state, "damage", `${damage} damage dealt to ${defender.name}.`, { attack, defense: result.defense, damage, hits: move.multiHitCount ?? 1 }));
  }
  if (move.healing) {
    const before = attacker.currentPower;
    attacker.currentPower = Math.min(attacker.maxPower, attacker.currentPower + move.healing);
    state.events.push(event(state, "heal", `${attacker.name} recovered ${attacker.currentPower - before} Power.`));
  }
  if (move.defenseModifier) attacker.effects.push({ id: `move-${state.turnNumber}`, kind: "defense", value: move.defenseModifier, expiresAt: "ownerTurnStart", sourceSide: sideId });
  if (move.enemyDefenseModifier) defender.effects.push({ id: `move-${state.turnNumber}`, kind: "defense", value: move.enemyDefenseModifier, expiresAt: "ownerTurnStart", sourceSide: sideId });
  if (move.evade) attacker.effects.push({ id: `move-${state.turnNumber}`, kind: "evade", value: 1, expiresAt: "onDamage", sourceSide: sideId });
  if (move.selfDamage) { attacker.currentPower = Math.max(0, attacker.currentPower - move.selfDamage); attacker.defeated = attacker.currentPower === 0; }
  attacker.effects = attacker.effects.filter((e) => !(e.kind === "attack" && e.expiresAt === "onAttack"));
  state.events.push(event(state, "special", `${move.name} succeeded. Cooldown set to ${move.cooldown}.`, { success: true, cooldown: move.cooldown }));
  if (defender.defeated) state.events.push(event(state, "ko", `${defender.name} was defeated.`));
  endTurn(state);
  return { success: true, damage, roll };
}

export function endTurn(state: BattleState) {
  if (checkVictory(state)) {
    state.events.push(event(state, "victory", `${state[state.winner!].name} won the match.`));
    return;
  }
  state.currentTurn = state.currentTurn === "player" ? "ai" : "player";
  state.turnNumber += 1;
  tickCooldowns(state[state.currentTurn]);
}

export function rollStartingPlayer(dice: Dice = randomDice): { player: number; ai: number; first: "player" | "ai" } {
  let player = dice.rollD6();
  let ai = dice.rollD6();
  while (player === ai) { player = dice.rollD6(); ai = dice.rollD6(); }
  return { player, ai, first: player > ai ? "player" : "ai" };
}
