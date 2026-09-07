import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import { describe, expect, it } from "vitest";
import { parsePassiveEffect } from "./passive-parser";

type HandlerRow = {
  "Handler #": string; Name: string;
  "Allegiance Passive Name": string; "Allegiance Passive Target": string; "Allegiance Passive Effect": string;
  "Order Passive Name": string; "Order Passive Target": string; "Order Passive Effect": string;
};

const csvPath = path.join(__dirname, "..", "..", "handlers.csv");
const rows = Papa.parse<HandlerRow>(fs.readFileSync(csvPath, "utf8"), { header: true, skipEmptyLines: true }).data;

describe("parsePassiveEffect against the full production Handler CSV", () => {
  it("parses at least 9 Handlers", () => {
    expect(rows.length).toBeGreaterThanOrEqual(9);
  });

  for (const row of rows) {
    it(`parses ${row.Name}'s Allegiance Passive ("${row["Allegiance Passive Effect"]}")`, () => {
      const passive = parsePassiveEffect(row["Allegiance Passive Name"], row["Allegiance Passive Target"], row["Allegiance Passive Effect"]);
      expect(passive.effects.length).toBeGreaterThan(0);
    });
    it(`parses ${row.Name}'s Order Passive ("${row["Order Passive Effect"]}")`, () => {
      const passive = parsePassiveEffect(row["Order Passive Name"], row["Order Passive Target"], row["Order Passive Effect"]);
      expect(passive.effects.length).toBeGreaterThan(0);
    });
  }
});

describe("parsePassiveEffect semantics", () => {
  it("parses a flat percent stat bonus", () => {
    expect(parsePassiveEffect("Stand Together", "Mortalbound", "+10% Power Score").effects).toEqual([
      { kind: "statModifier", stat: "power", subject: "self", percent: 10, duration: { unit: "untilOwnerNextTurn" } },
    ]);
    expect(parsePassiveEffect("Overcharge", "Mortalbound", "+10% Base ATK").effects).toEqual([
      { kind: "statModifier", stat: "atk", subject: "self", percent: 10, duration: { unit: "untilOwnerNextTurn" } },
    ]);
    expect(parsePassiveEffect("Battle Command", "Mortalbound", "+10% DEF").effects).toEqual([
      { kind: "statModifier", stat: "def", subject: "self", percent: 10, duration: { unit: "untilOwnerNextTurn" } },
    ]);
  });

  it("parses a cooldown-reduction-per-use passive with its floor", () => {
    expect(parsePassiveEffect("Improvised Tactics", "Starwatch", "Special Move recovery time reduced by 1 turn, minimum 1").effects).toEqual([
      { kind: "cooldownReductionPerUse", amount: -1, floor: 1 },
    ]);
  });
});
