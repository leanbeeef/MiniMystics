import type { EffectDuration, EffectSpec, EffectSubject, ParsedMove } from "./types";

const turns = (count: string): EffectDuration => ({ unit: "turns", count: Number(count) });
const next: EffectDuration = { unit: "untilOwnerNextTurn" };
const stat = (subject: EffectSubject, name: string, percent: string, duration: EffectDuration, negative = false): EffectSpec =>
  ({ kind: "statModifier", subject, stat: name.toLowerCase() as "atk" | "def", percent: Number(percent) * (negative ? -1 : 1), duration });
const power = (subject: EffectSubject, amount: string, healing = true, basis?: "maximum" | "current"): EffectSpec =>
  ({ kind: "powerChange", subject, healing, ...(basis ? { percent: Number(amount), basis } : { amount: Number(amount) }) });
const cooldown = (subject: EffectSubject, amount: string, increase = false, scope: "longestActive" | "allActive" = "longestActive", order?: string): EffectSpec =>
  ({ kind: "cooldownDelta", subject, scope, amount: Number(amount) * (increase ? 1 : -1), ...(order ? { order } : {}) });
type Result = Pick<ParsedMove, "effects" | "targetType" | "damageModifierPercent">;
type Rule = { pattern: RegExp; target: Result["targetType"]; build: (m: RegExpMatchArray) => EffectSpec[]; damage?: (m: RegExpMatchArray) => number };

// Fully anchored compound clauses: a partial match never silently drops a second effect.
// Grammar is based on wording, so future cards can reuse these effects without ID branches.
const rules: Rule[] = [
  { pattern: /^Self gains \+(\d+)% ATK and \+(\d+)% DEF for (\d+) turns\.$/, target: "self", build: m => [stat("self", "atk", m[1], turns(m[3])), stat("self", "def", m[2], turns(m[3]))] },
  { pattern: /^Self gains \+(\d+)% (ATK|DEF) for (\d+) turns\.$/, target: "self", build: m => [stat("self", m[2], m[1], turns(m[3]))] },
  { pattern: /^Target enemy Mystic loses (\d+)% (ATK|DEF) for (\d+) turns\.$/, target: "enemy", build: m => [stat("target", m[2], m[1], turns(m[3]), true)] },
  { pattern: /^All allied Mystics gain \+(\d+)% (ATK|DEF) for (\d+) turns and recover (\d+) Power\.$/, target: "self", build: m => [stat("allTeam", m[2], m[1], turns(m[3])), power("allTeam", m[4])] },
  { pattern: /^All allied Mystics gain \+(\d+)% (ATK|DEF) for (\d+) turns and reduce one active Special cooldown by (\d+)\.$/, target: "self", build: m => [stat("allTeam", m[2], m[1], turns(m[3])), cooldown("allTeam", m[4])] },
  { pattern: /^Self gains \+(\d+)% ATK until the end of the turn and recovers (\d+) Power\.$/, target: "enemy", damage: m => Number(m[1]), build: m => [power("self", m[2])] },
  { pattern: /^Self gains \+(\d+)% ATK for this attack\.$/, target: "enemy", damage: m => Number(m[1]), build: () => [] },
  { pattern: /^All allied Mystics recover (\d+) Power and gain \+(\d+)% DEF until the start of your next turn\.$/, target: "self", build: m => [power("allTeam", m[1]), stat("allTeam", "def", m[2], next)] },
  { pattern: /^All enemy Mystics lose (\d+)% ATK for (\d+) turns and have their active Special cooldowns increased by (\d+)\.$/, target: "self", build: m => [stat("allEnemies", "atk", m[1], turns(m[2]), true), cooldown("allEnemies", m[3], true, "allActive")] },
  { pattern: /^Choose 1 allied Mystic\. It recovers (\d+) Power\.$/, target: "ally", build: m => [power("target", m[1])] },
  { pattern: /^All allied Mystics recover (\d+)% of their maximum Power Score and gain \+(\d+)% DEF for (\d+) turns\.$/, target: "self", build: m => [power("allTeam", m[1], true, "maximum"), stat("allTeam", "def", m[2], turns(m[3]))] },
  { pattern: /^Target enemy loses (\d+)% DEF for (\d+) turns\. All allied (.+) Mystics reduce one active Special cooldown by (\d+)\.$/, target: "enemy", build: m => [stat("target", "def", m[1], turns(m[2]), true), cooldown("allTeam", m[4], false, "longestActive", m[3])] },
  { pattern: /^Choose 1 allied Mystic\. The next attack targeting it deals 0 damage, and it gains \+(\d+)% ATK until the start of your next turn\.$/, target: "ally", build: m => [{ kind: "untouchable", subject: "target", duration: { unit: "untilConsumed" } }, stat("target", "atk", m[1], next)] },
  { pattern: /^Choose 1 allied Mystic\. Reduce one of its active Special cooldowns by (\d+), minimum 0\.$/, target: "ally", build: m => [cooldown("target", m[1])] },
  { pattern: /^Increase all active enemy Special cooldowns by (\d+) and reduce enemy team ATK by (\d+)% for (\d+) turns\.$/, target: "self", build: m => [cooldown("allEnemies", m[1], true, "allActive"), stat("allEnemies", "atk", m[2], turns(m[3]), true)] },
  { pattern: /^Choose 1 allied Mystic\. It gains \+(\d+)% DEF for (\d+) turns and reduces one active Special cooldown by (\d+)\.$/, target: "ally", build: m => [stat("target", "def", m[1], turns(m[2])), cooldown("target", m[3])] },
  { pattern: /^Target enemy loses (\d+)% DEF for (\d+) turns and cannot receive new DEF buffs until the start of your next turn\.$/, target: "enemy", build: m => [stat("target", "def", m[1], turns(m[2]), true), { kind: "blockDefenseBuff", subject: "target", duration: { unit: "untilSourceNextTurn" } }] },
  { pattern: /^Target enemy Mystic loses (\d+)% DEF for (\d+) turns and one active Special cooldown is increased by (\d+)\.$/, target: "enemy", build: m => [stat("target", "def", m[1], turns(m[2]), true), cooldown("target", m[3], true)] },
  { pattern: /^All enemy Mystics lose (\d+)% of their current Power Score and (\d+)% ATK for (\d+) turns\. .+ loses (\d+) Power after the effect resolves\.$/, target: "self", build: m => [power("allEnemies", m[1], false, "current"), stat("allEnemies", "atk", m[2], turns(m[3]), true), power("self", m[4], false)] },
];

export function parseTeamMove(text: string): Result | undefined {
  for (const rule of rules) {
    const match = text.trim().match(rule.pattern);
    if (match) return { targetType: rule.target, effects: rule.build(match), damageModifierPercent: rule.damage?.(match) };
  }
}
