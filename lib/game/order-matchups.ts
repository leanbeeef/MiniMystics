export const ORDERS = [
  "Order of the Star", "Sovereign Order", "Starwatch", "Stargate", "Worldforge",
  "Verdant Dawn", "Sunspire", "Moonveil", "Agespire", "First Spark",
] as const;
export type Order = (typeof ORDERS)[number];

export const ORDER_ADVANTAGE_PERCENT = 25;

export const ORDER_MATCHUPS: Record<Order, { strongAgainst: Order; weakAgainst: Order }> = {
  "Order of the Star": { strongAgainst: "Sovereign Order", weakAgainst: "First Spark" },
  "Sovereign Order": { strongAgainst: "Starwatch", weakAgainst: "Order of the Star" },
  "Starwatch": { strongAgainst: "Stargate", weakAgainst: "Sovereign Order" },
  "Stargate": { strongAgainst: "Worldforge", weakAgainst: "Starwatch" },
  "Worldforge": { strongAgainst: "Verdant Dawn", weakAgainst: "Stargate" },
  "Verdant Dawn": { strongAgainst: "Sunspire", weakAgainst: "Worldforge" },
  "Sunspire": { strongAgainst: "Moonveil", weakAgainst: "Verdant Dawn" },
  "Moonveil": { strongAgainst: "Agespire", weakAgainst: "Sunspire" },
  "Agespire": { strongAgainst: "First Spark", weakAgainst: "Moonveil" },
  "First Spark": { strongAgainst: "Order of the Star", weakAgainst: "Agespire" },
};

/** +25% ATK when attackerOrder is strong against defenderOrder. No separate weak-side penalty — the counter emerges when the other side attacks back. */
export function orderAdvantagePercent(attackerOrder: string, defenderOrder: string): number {
  return ORDER_MATCHUPS[attackerOrder as Order]?.strongAgainst === defenderOrder ? ORDER_ADVANTAGE_PERCENT : 0;
}

export const SYNERGY_PERCENT_BY_COUNT: Record<number, number> = { 2: 5, 3: 10, 4: 15, 5: 20, 6: 25, 7: 30, 8: 35 };

/** Order -> synergy percent for a starting lineup, based only on Order counts (Handlers never count). Fixed at battle start. */
export function computeOrderSynergies(orders: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const order of orders) counts[order] = (counts[order] ?? 0) + 1;
  const synergies: Record<string, number> = {};
  for (const [order, count] of Object.entries(counts)) {
    const percent = SYNERGY_PERCENT_BY_COUNT[Math.min(count, 8)];
    if (percent) synergies[order] = percent;
  }
  return synergies;
}
