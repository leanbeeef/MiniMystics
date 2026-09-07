import type { Rarity } from "./types";

/** Coins granted when quick-selling a duplicate card. Unchanged from the pre-existing values inline in game-provider.tsx. */
export const RARITY_SELL_COINS: Record<Rarity | "Unassigned", number> = {
  Wild: 20, Hunter: 35, Predator: 60, Prime: 100, Alpha: 180, Apex: 350, Unassigned: 80,
};

/** Order Essence granted when dismantling a duplicate Mystic. Higher rarity yields more, per spec. Admin-configurable reference lives in the `RarityCardValue` Prisma model (Part A2) — these are the live numbers the game actually uses, matching how PACK_DEFINITIONS/STANDARD_RARITY_WEIGHTS already work in this codebase. */
export const RARITY_DISMANTLE_ESSENCE: Record<Rarity | "Unassigned", number> = {
  Wild: 15, Hunter: 25, Predator: 45, Prime: 75, Alpha: 130, Apex: 250, Unassigned: 60,
};

/** Order Essence cost to reach a given level (2..10) from the previous level. Same curve regardless of rarity — progressively steeper per spec. Admin-configurable reference: `MysticLevelCost` Prisma model. */
export const LEVEL_UP_ESSENCE_COST: Record<number, number> = {
  2: 20, 3: 35, 4: 55, 5: 80, 6: 120, 7: 170, 8: 230, 9: 300, 10: 380,
};

export const MAX_MYSTIC_LEVEL = 10;

/** +2% per level above 1, e.g. level 10 = +18%. */
export const levelBonusPercent = (level: number) => (level - 1) * 2;
