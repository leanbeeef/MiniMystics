import { describe, expect, it } from "vitest";
import { computeOrderSynergies, ORDER_MATCHUPS, orderAdvantagePercent, SYNERGY_PERCENT_BY_COUNT } from "./order-matchups";

const CYCLE: [string, string][] = [
  ["Order of the Star", "Sovereign Order"],
  ["Sovereign Order", "Starwatch"],
  ["Starwatch", "Stargate"],
  ["Stargate", "Worldforge"],
  ["Worldforge", "Verdant Dawn"],
  ["Verdant Dawn", "Sunspire"],
  ["Sunspire", "Moonveil"],
  ["Moonveil", "Agespire"],
  ["Agespire", "First Spark"],
  ["First Spark", "Order of the Star"],
];

describe("Order Advantage", () => {
  it.each(CYCLE)("%s is strong against %s: +25%% ATK", (attacker, defender) => {
    expect(orderAdvantagePercent(attacker, defender)).toBe(25);
  });

  it.each(CYCLE)("%s attacking %s (its weak side) receives no separate penalty", (_attacker, defender) => {
    // The counter naturally emerges when the defender attacks back, not as a penalty on the attacker.
    expect(orderAdvantagePercent(defender, _attacker)).toBe(0);
  });

  it("every Order has exactly one strong and one weak matchup", () => {
    for (const [order, matchup] of Object.entries(ORDER_MATCHUPS)) {
      expect(matchup.strongAgainst).not.toBe(order);
      expect(matchup.weakAgainst).not.toBe(order);
      expect(matchup.strongAgainst).not.toBe(matchup.weakAgainst);
    }
  });

  it("returns 0 for unrelated Orders", () => {
    expect(orderAdvantagePercent("Order of the Star", "Worldforge")).toBe(0);
  });
});

describe("Order Synergy", () => {
  it.each(Object.entries(SYNERGY_PERCENT_BY_COUNT))("%s matching Mystics grants +%s%%", (count, percent) => {
    const orders = Array.from({ length: Number(count) }, () => "Worldforge");
    expect(computeOrderSynergies(orders)).toEqual({ Worldforge: percent });
  });

  it("does not grant synergy for a single Mystic", () => {
    expect(computeOrderSynergies(["Worldforge"])).toEqual({});
  });

  it("supports multiple simultaneous synergies without cross-contamination", () => {
    const orders = [...Array(4).fill("Worldforge"), ...Array(4).fill("Sunspire")];
    expect(computeOrderSynergies(orders)).toEqual({ Worldforge: 15, Sunspire: 15 });
  });

  it("caps at the 8-count tier for larger counts", () => {
    const orders = Array.from({ length: 9 }, () => "Worldforge");
    expect(computeOrderSynergies(orders)).toEqual({ Worldforge: 35 });
  });
});
