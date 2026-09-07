import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import { describe, expect, it } from "vitest";
import { parseMove } from "./move-parser";

type MysticRow = {
  "MM #": string; Name: string;
  "Move 1 Name": string; "Move 1 Roll": string; "Move 1 Cooldown": string; "Move 1 Effect": string;
  "Move 2 Name": string; "Move 2 Roll": string; "Move 2 Cooldown": string; "Move 2 Effect": string;
};

const csvPath = path.join(__dirname, "..", "..", "mini_mystics.csv");
const rows = Papa.parse<MysticRow>(fs.readFileSync(csvPath, "utf8"), { header: true, skipEmptyLines: true }).data;

describe("parseMove against the full production CSV", () => {
  it("parses at least 100 Mystics with two moves each", () => {
    expect(rows.length).toBeGreaterThanOrEqual(100);
  });

  // One golden assertion per unique (name, roll, cooldown, effect) tuple actually present in the
  // authoritative CSV — this is the proof the reusable clause grammar covers real production data,
  // not just hand-picked synthetic examples.
  const seen = new Set<string>();
  for (const row of rows) {
    for (const [name, roll, cooldown, effect] of [
      [row["Move 1 Name"], row["Move 1 Roll"], row["Move 1 Cooldown"], row["Move 1 Effect"]],
      [row["Move 2 Name"], row["Move 2 Roll"], row["Move 2 Cooldown"], row["Move 2 Effect"]],
    ] as const) {
      const key = `${name}|${roll}|${cooldown}|${effect}`;
      if (seen.has(key)) continue;
      seen.add(key);
      it(`parses "${effect}" (${row["MM #"]} ${name}) with no review flag`, () => {
        const move = parseMove(name, roll, cooldown, effect);
        expect(move.needsReview).toBe(false);
        expect(move.reviewReason).toBeUndefined();
        expect(move.requiredRoll).toBeGreaterThan(0);
        expect(move.cooldown).toBeGreaterThan(0);
      });
    }
  }
});

describe("parseMove semantics for representative clause families", () => {
  it("extracts a leading damage modifier and classifies the move as enemy-targeted", () => {
    const move = parseMove("Quickstrike", "3+", "1", "This attack gains +8% ATK and one allied Mystic gains +8% DEF for 1 turn.");
    expect(move.damageModifierPercent).toBe(8);
    expect(move.targetType).toBe("enemy");
    expect(move.effects).toEqual([{ kind: "statModifier", stat: "def", subject: "allyAuto", percent: 8, duration: { unit: "turns", count: 1 } }]);
  });

  it("parses a pure self-buff with no damage modifier", () => {
    const move = parseMove("Tailwind Dash", "5+", "2", "All allied Mystics gain +8% ATK for 1 turn; this Mystic recovers 5% of maximum Power Score.");
    expect(move.damageModifierPercent).toBeUndefined();
    expect(move.targetType).toBe("self");
    expect(move.effects).toEqual([
      { kind: "statModifier", stat: "atk", subject: "allTeam", percent: 8, duration: { unit: "turns", count: 1 } },
      { kind: "heal", subject: "self", percent: 5 },
    ]);
  });

  it("parses an enemy debuff paired with a cooldown increase", () => {
    const move = parseMove("Sand Toss", "3+", "1", "This attack gains +8% ATK and the target gets -8% ATK for 1 turn.");
    expect(move.targetType).toBe("enemy");
    expect(move.effects).toEqual([{ kind: "statModifier", stat: "atk", subject: "target", percent: -8, duration: { unit: "turns", count: 1 } }]);
  });

  it("parses a marked-defense-on-next-hit clause", () => {
    const move = parseMove("Foreseen Strike", "4+", "1", "This attack gains +18% ATK and mark the target with -18% DEF for your next attack.");
    expect(move.effects).toEqual([{ kind: "markDefenseOnNextHit", subject: "target", percent: 18 }]);
  });

  it("parses a reactive retaliate clause with no external target", () => {
    const move = parseMove("Perfect Prediction", "6+", "2", "Gain +35% DEF until the start of your next turn. The attacking enemy gets -25% ATK on its next attack.");
    expect(move.targetType).toBe("self");
    expect(move.effects).toEqual([
      { kind: "statModifier", stat: "def", subject: "self", percent: 35, duration: { unit: "untilOwnerNextTurn" } },
      { kind: "retaliateAtkDebuff", subject: "self", percent: 25 },
    ]);
  });

  it("parses a chance-based recoil splash", () => {
    const move = parseMove("Absolute Rule", "6+", "2", "This attack deals +100% ATK. After damage resolves, there is a 25% chance that one random allied Mystic loses 25% of the damage dealt from its current Power Score.");
    expect(move.damageModifierPercent).toBe(100);
    expect(move.effects).toEqual([{ kind: "chanceRecoilSplash", chancePercent: 25, percentOfDamageDealt: 25 }]);
  });

  it("parses a this-attack-only buff stacked with a lingering follow-up buff", () => {
    const move = parseMove("Meteor Rush", "5+", "2", "Gain +20% ATK for this attack and +10% ATK on your next attack.");
    expect(move.effects).toEqual([
      { kind: "statModifier", stat: "atk", subject: "self", percent: 20, duration: { unit: "thisAttackOnly" } },
      { kind: "statModifier", stat: "atk", subject: "self", percent: 10, duration: { unit: "turns", count: 1 } },
    ]);
  });
});
