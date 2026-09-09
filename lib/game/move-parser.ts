import { parseTeamMove } from "./team-move-parser";
import type { EffectDuration, EffectSpec, ParsedMove } from "./types";

const num = (text: string) => Number(text);

function parseDuration(text: string): EffectDuration {
  if (/until (?:the start of )?your next turn/i.test(text)) return { unit: "untilOwnerNextTurn" };
  if (/for this attack/i.test(text)) return { unit: "thisAttackOnly" };
  const turns = text.match(/for (\d+) turns?/i);
  if (turns) return { unit: "turns", count: num(turns[1]) };
  return { unit: "turns", count: 1 };
}

type Rule = { pattern: RegExp; build: (match: RegExpMatchArray) => EffectSpec[] };

// Each rule matches one self-contained sentence/clause. Parameterized purely over the
// numbers/words the CSV varies (percentages, turn counts) — never over a Mystic's identity.
const RULES: Rule[] = [
  // "Gain +X% ATK and +X% DEF for N turns." (combined ATK+DEF, must come before the single-stat rule)
  {
    pattern: /^Gain \+(\d+)% ATK and \+(\d+)% DEF for (\d+) turns?\.?$/i,
    build: (m) => [
      { kind: "statModifier", stat: "atk", subject: "self", percent: num(m[1]), duration: { unit: "turns", count: num(m[3]) } },
      { kind: "statModifier", stat: "def", subject: "self", percent: num(m[2]), duration: { unit: "turns", count: num(m[3]) } },
    ],
  },
  // "Gain +X% ATK/DEF for N turn(s)." / "until your next turn"
  {
    pattern: /^Gain \+(\d+)% (ATK|DEF) (?:for \d+ turns?|until (?:the start of )?your next turn)\.?/i,
    build: (m) => [{ kind: "statModifier", stat: m[2].toLowerCase() as "atk" | "def", subject: "self", percent: num(m[1]), duration: parseDuration(m[0]) }],
  },
  // "Recover X% of maximum Power Score" / "Recover X% of this Mystic's maximum Power Score"
  {
    pattern: /Recover (\d+)% of (?:this Mystic's )?maximum Power Score/i,
    build: (m) => [{ kind: "heal", subject: "self", percent: num(m[1]) }],
  },
  // "this Mystic recovers X% of its/maximum Power Score"
  {
    pattern: /this Mystic recovers (\d+)% of (?:its )?maximum Power Score/i,
    build: (m) => [{ kind: "heal", subject: "self", percent: num(m[1]) }],
  },
  // "lose X% of maximum Power Score" / "this Mystic loses X% of maximum Power Score"
  {
    pattern: /lose[s]? (\d+)% of (?:this Mystic's |its )?maximum Power Score/i,
    build: (m) => [{ kind: "recoil", subject: "self", percent: num(m[1]) }],
  },
  // "and reduce one allied Mystic's active Special Move recovery by N turn" / "reduce one active Special Move recovery by N turn"
  {
    pattern: /reduce (?:one allied Mystic's|one) active Special Move recovery by (\d+) turns?/i,
    build: (m) => [{ kind: "cooldownDelta", subject: "self", scope: "longestActive", amount: -num(m[1]) }],
  },
  // "reduce both of this Mystic's active Special Move recoveries by N turn" / "reduce both of its active Special Move recoveries by N turn"
  {
    pattern: /reduce both of (?:this Mystic's|its) active Special Move recoveries by (\d+) turns?/i,
    build: (m) => [{ kind: "cooldownDelta", subject: "self", scope: "bothMoves", amount: -num(m[1]) }],
  },
  // "reduce this Mystic's other Special Move recovery by N turn"
  {
    pattern: /reduce this Mystic's other Special Move recovery by (\d+) turns?/i,
    build: (m) => [{ kind: "cooldownDelta", subject: "self", scope: "otherMove", amount: -num(m[1]) }],
  },
  // "increase target's/its/the attacker's/the target Mystic's longest active Special Move recovery by N turn"
  {
    pattern: /increase (?:the )?(?:target's|target Mystic's|its|the attacker's) (?:longest active )?Special Move recovery by (\d+) turns?/i,
    build: (m) => [{ kind: "cooldownDelta", subject: "target", scope: "longestActive", amount: num(m[1]) }],
  },
  // "All allied Mystics gain +X% ATK/DEF for N turn(s)"
  {
    pattern: /All allied Mystics gain \+(\d+)% (ATK|DEF) for (\d+) turns?/i,
    build: (m) => [{ kind: "statModifier", stat: m[2].toLowerCase() as "atk" | "def", subject: "allTeam", percent: num(m[1]), duration: { unit: "turns", count: num(m[3]) } }],
  },
  // "Gain +X% ATK for this attack and +Y% ATK on your next attack."
  {
    pattern: /Gain \+(\d+)% ATK for this attack and \+(\d+)% ATK on your next attack\.?/i,
    build: (m) => [
      { kind: "statModifier", stat: "atk", subject: "self", percent: num(m[1]), duration: { unit: "thisAttackOnly" } },
      { kind: "statModifier", stat: "atk", subject: "self", percent: num(m[2]), duration: { unit: "turns", count: 1 } },
    ],
  },
  // "The attacking enemy gets -X% ATK on its next attack." (reactive, phrased without "If hit,")
  {
    pattern: /The attacking enemy gets -(\d+)% ATK on its next attack/i,
    build: (m) => [{ kind: "retaliateAtkDebuff", subject: "self", percent: num(m[1]) }],
  },
  // "increase both of its Special Move recoveries by N turn"
  {
    pattern: /increase both of its Special Move recoveries by (\d+) turns?/i,
    build: (m) => [{ kind: "cooldownDelta", subject: "target", scope: "bothMoves", amount: num(m[1]) }],
  },
  // "reduce the target's ATK and DEF by X% for N turns" (combined)
  {
    pattern: /Reduce the target's ATK and DEF by (\d+)% for (\d+) turns?\.?/i,
    build: (m) => [
      { kind: "statModifier", stat: "atk", subject: "target", percent: -num(m[1]), duration: { unit: "turns", count: num(m[2]) } },
      { kind: "statModifier", stat: "def", subject: "target", percent: -num(m[1]), duration: { unit: "turns", count: num(m[2]) } },
    ],
  },
  // "Reduce the target's ATK/DEF by X% for N turns" / "for this attack"
  {
    pattern: /Reduce the target's (ATK|DEF) by (\d+)% (for \d+ turns?|for this attack)\.?/i,
    build: (m) => [{ kind: "statModifier", stat: m[1].toLowerCase() as "atk" | "def", subject: "target", percent: -num(m[2]), duration: parseDuration(m[0]) }],
  },
  // "reduce target ATK/DEF by X% for 1 turn" / "for this attack" (attached to an attack move)
  {
    pattern: /reduce target (ATK|DEF) by (\d+)% (for \d+ turns?|for this attack)/i,
    build: (m) => [{ kind: "statModifier", stat: m[1].toLowerCase() as "atk" | "def", subject: "target", percent: -num(m[2]), duration: parseDuration(m[0]) }],
  },
  // "the target gets -X% ATK for 1 turn"
  {
    pattern: /the target gets -(\d+)% ATK for (\d+) turns?/i,
    build: (m) => [{ kind: "statModifier", stat: "atk", subject: "target", percent: -num(m[1]), duration: { unit: "turns", count: num(m[2]) } }],
  },
  // "mark the target with -X% DEF for your next attack"
  {
    pattern: /mark the target with -(\d+)% DEF for your next attack/i,
    build: (m) => [{ kind: "markDefenseOnNextHit", subject: "target", percent: num(m[1]) }],
  },
  // "The target loses X% DEF until the start of your next turn"
  {
    pattern: /The target loses (\d+)% DEF until (?:the start of )?your next turn/i,
    build: (m) => [{ kind: "statModifier", stat: "def", subject: "target", percent: -num(m[1]), duration: { unit: "untilOwnerNextTurn" } }],
  },
  // "Reduce the target's DEF by X% for this attack and gain +Y% DEF until your next turn." handled by separate clauses already (DEF-for-this-attack rule above + self-gain rule above)
  // "the attacker gets -X% ATK for its next turn" (reactive, "If hit, ...")
  {
    pattern: /If hit, the attacker gets -(\d+)% ATK for its next turn/i,
    build: (m) => [{ kind: "retaliateAtkDebuff", subject: "self", percent: num(m[1]) }],
  },
  // "reduce the next attacker's ATK by X% for that attack" (reactive)
  {
    pattern: /reduce the next attacker's ATK by (\d+)% for that attack/i,
    build: (m) => [{ kind: "retaliateAtkDebuff", subject: "self", percent: num(m[1]) }],
  },
  // "increase the attacker's longest active Special Move recovery by N turn if you are hit" (reactive) — matched by the generic cooldown-increase rule above via "the attacker's"; keep as-is.
  // "Afterward, this Mystic gets -X% DEF until your next turn."
  {
    pattern: /this Mystic gets -(\d+)% DEF until (?:the start of )?your next turn/i,
    build: (m) => [{ kind: "statModifier", stat: "def", subject: "self", percent: -num(m[1]), duration: { unit: "untilOwnerNextTurn" } }],
  },
  // "one allied Mystic gains +X% DEF for 1 turn" / "one other allied Mystic gains +X% DEF for 1 turn"
  {
    pattern: /one (?:other )?allied Mystic gains \+(\d+)% DEF for (\d+) turns?/i,
    build: (m) => [{ kind: "statModifier", stat: "def", subject: "allyAuto", percent: num(m[1]), duration: { unit: "turns", count: num(m[2]) } }],
  },
  // "there is a 25% chance that one random allied Mystic loses 25% of the damage dealt from its current Power Score"
  {
    pattern: /there is a (\d+)% chance that one random allied Mystic loses (\d+)% of the damage dealt/i,
    build: (m) => [{ kind: "chanceRecoilSplash", chancePercent: num(m[1]), percentOfDamageDealt: num(m[2]) }],
  },
];

function parseClauses(text: string): { effects: EffectSpec[]; unmatched: string[] } {
  const effects: EffectSpec[] = [];
  const unmatched: string[] = [];
  // Split on sentence boundaries first, then on "; ", keeping each fragment intact (rules match "and"-joined clauses as whole sentences).
  const sentences = text.split(/(?<=\.)\s+|;\s+/).map((s) => s.trim()).filter(Boolean);
  for (const sentence of sentences) {
    let matchedAny = false;
    for (const rule of RULES) {
      const match = sentence.match(rule.pattern);
      if (match) { effects.push(...rule.build(match)); matchedAny = true; }
    }
    if (!matchedAny) unmatched.push(sentence);
  }
  return { effects, unmatched };
}

export function parseMove(name: string, rollText: string, cooldownText: string, effectText: string): ParsedMove {
  const rawText = `${name}: ${rollText} | CD ${cooldownText} | ${effectText}`.trim();
  const requiredRoll = Number(rollText.match(/\d+/)?.[0] ?? 8);
  const cooldown = Number(cooldownText.match(/\d+/)?.[0] ?? 1);
  const compound = parseTeamMove(effectText);
  if (compound) return { name: name.trim(), requiredRoll, cooldown, rawText, needsReview: false, ...compound };
  let text = effectText.trim();

  let damageModifierPercent: number | undefined;
  const leadingModifier = text.match(/^This attack (?:gains|deals) \+(\d+)% ATK\.?\s*/i);
  if (leadingModifier) {
    damageModifierPercent = num(leadingModifier[1]);
    text = text.slice(leadingModifier[0].length).trim();
  }

  const { effects, unmatched } = parseClauses(text);

  // A move that carries its own damage modifier (or otherwise references "the target"/"the
  // attacker") is always played against the chosen enemy, regardless of any secondary
  // ally-buff clause riding along with it — e.g. "This attack gains +8% ATK and one allied
  // Mystic gains +8% DEF for 1 turn." targets the enemy; the ally buff is a side effect
  // auto-resolved per Part B2 (lowest-Power surviving ally). In the current data, a bare "one
  // (other) allied Mystic" reference with no enemy involvement always rides on an otherwise
  // self-targeted buff move, so it never produces a standalone "ally" targetType — the type
  // still supports one for a future CSV move whose sole purpose is buffing a chosen ally.
  const externalTarget = damageModifierPercent !== undefined || /\btarget\b|attacker's/i.test(effectText);
  const targetType: ParsedMove["targetType"] = externalTarget ? "enemy" : "self";

  return {
    name: name.trim(),
    requiredRoll,
    cooldown,
    targetType,
    damageModifierPercent,
    effects,
    rawText,
    needsReview: unmatched.length > 0,
    reviewReason: unmatched.length ? unmatched.join("; ") : undefined,
  };
}
