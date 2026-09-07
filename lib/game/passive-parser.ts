import type { EffectSpec, PassiveEffect } from "./types";

const STAT_WORDS: Record<string, "atk" | "def" | "power"> = {
  "power score": "power",
  "base atk": "atk",
  "def": "def",
};

/**
 * Handler passives (Allegiance/Order) use only two shapes in the authoritative CSV:
 *   "+N% <Power Score|Base ATK|DEF>"
 *   "Special Move recovery time reduced by N turn, minimum M"
 * Both are covered here. Anything else is left as an empty effect list (the raw text
 * still displays in the UI) rather than guessed at.
 */
export function parsePassiveEffect(name: string, targetLabel: string, rawText: string): PassiveEffect {
  const text = rawText.trim();
  const effects: EffectSpec[] = [];

  const percentMatch = text.match(/^([+-]?\d+)%\s+(Power Score|Base ATK|DEF)$/i);
  if (percentMatch) {
    const stat = STAT_WORDS[percentMatch[2].toLowerCase()];
    effects.push({ kind: "statModifier", stat, subject: "self", percent: Number(percentMatch[1]), duration: { unit: "untilOwnerNextTurn" } });
  }

  const cooldownMatch = text.match(/Special Move recovery time reduced by (\d+) turns?(?:,\s*minimum\s*(\d+))?/i);
  if (cooldownMatch) {
    effects.push({ kind: "cooldownReductionPerUse", amount: -Number(cooldownMatch[1]), floor: Number(cooldownMatch[2] ?? 1) });
  }

  return { name, targetLabel, effects, rawText: text };
}
