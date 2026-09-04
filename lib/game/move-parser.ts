import type { ParsedMove } from "./types";

const numberAfter = (text: string, pattern: RegExp) => {
  const match = text.match(pattern);
  return match ? Number(match[1]) : undefined;
};

export function parseMove(input: string, index = 0): ParsedMove {
  const rawText = input.trim();
  const [namePart, rulesPart = ""] = rawText.split(/:\s*/, 2);
  const rollText = rulesPart.split("=")[0]?.trim() ?? "";
  const effect = rulesPart.split("=").slice(1).join("=").trim();
  const roll = Number(rollText.match(/\d/)?.[0] ?? 6);
  const exactRoll = !rollText.includes("+");
  const lower = effect.toLowerCase();
  const review: string[] = [];

  const move: ParsedMove = {
    name: namePart.trim(),
    requiredRoll: roll,
    ...(exactRoll ? { exactRoll: roll } : { minimumRoll: roll }),
    cooldown: index === 0 ? 1 : 2,
    targetType: /enemy|attack|strike|bite|slam|shot|slash|jab|crush|fist|ram|blow|rend|claw|whip|bolt|beam|lance|lash|spear/i.test(`${namePart} ${effect}`) ? "enemy" : "self",
    rawText,
    needsReview: false,
  };

  if (/\+\d+\s*atk/i.test(effect)) move.attackModifier = numberAfter(effect, /\+(\d+)\s*ATK/i);
  if (/\+\d+\s*def/i.test(effect)) move.defenseModifier = numberAfter(effect, /\+(\d+)\s*DEF/i);
  if (/enemy\s*-\d+\s*atk/i.test(effect)) move.enemyAttackModifier = -(numberAfter(effect, /enemy\s*-(\d+)\s*ATK/i) ?? 0);
  if (/enemy\s*-\d+\s*def/i.test(effect)) move.enemyDefenseModifier = -(numberAfter(effect, /enemy\s*-(\d+)\s*DEF/i) ?? 0);
  if (/recover|heal|restore/i.test(effect)) move.healing = numberAfter(effect, /(?:recover|heal|restore)\s+(\d+)\s*(?:Power)?/i);
  if (/attack twice/i.test(effect)) move.multiHitCount = 2;
  if (/base attack x2/i.test(effect)) move.attackMultiplier = 2;
  if (/ignore(?:s)? DEF|DEF becomes 0/i.test(effect)) move.ignoreDefense = true;
  if (/evade/i.test(effect)) move.evade = true;
  if (/return|counter|reflect/i.test(effect)) move.counter = numberAfter(effect, /(?:return|reflect)\s+(\d+)/i) ?? "base";
  if (/skip|loses attack|loses next move|cannot use special|loses special/i.test(lower)) move.skipTurn = true;
  if (/lose \d+ power/i.test(lower)) move.selfDamage = numberAfter(effect, /lose\s+(\d+)\s+Power/i);

  const supported = [
    /\+\d+\s*ATK/i, /\+\d+\s*DEF/i, /enemy\s*-\d+\s*(ATK|DEF)/i,
    /(recover|heal|restore)\s+\d+/i, /attack twice/i, /Base Attack x2/i,
    /ignore(?:s)? DEF|DEF becomes 0/i, /evade/i, /return|counter|reflect/i,
    /block|reduce damage|halve next hit/i, /misses|skip|loses attack|loses next move|cannot use special|loses special/i,
  ];
  if (!supported.some((p) => p.test(effect))) review.push("effect pattern is not deterministic");
  if (/half-power|swap ATK|attack before opponent|next attack x2|heal half damage/i.test(effect)) review.push("timing or calculation needs rules confirmation");
  if (/block|reduce damage|halve next hit|misses|loses attack|skips|counter|return|reflect|enemy\s*-\d+\s*ATK|next attack \+\d+/i.test(effect)) review.push("parsed but not enabled in the v1 battle executor");
  if (/and/.test(lower) && !(/heal|recover|evade|ignore|special/i.test(lower))) review.push("compound effect needs review");
  move.needsReview = review.length > 0;
  if (review.length) move.reviewReason = [...new Set(review)].join("; ");
  return move;
}

export function parseMoves(value: string): ParsedMove[] {
  return value.split(";").map((move, index) => parseMove(move, index));
}
