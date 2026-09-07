import type { Rarity } from "./types";

export const STANDARD_RARITY_WEIGHTS: Record<Rarity, number> = {
  Wild: 53, Hunter: 27, Predator: 12, Prime: 5.5, Alpha: 2, Apex: 0.5,
};

/**
 * Standard Pack is the basic general-purpose pack, not automatically the best-value pack —
 * it guarantees only its Mystic cards; a Handler and a bonus reward card are chance-based
 * rather than guaranteed, so the specialized packs (Order/Void/Handler) keep a real reason to
 * exist instead of being strictly worse than a cheaper pack that already gives everything.
 */
export const PACK_DEFINITIONS = [
  { id: "standard", name: "Standard Pack", description: "Five Mystic cards at standard odds, with a chance of a bonus Handler or reward card.", cardCount: 5, coinPrice: 350, theme: "Standard", active: true, handlerChancePercent: 20, bonusRewardChancePercent: 25 },
  { id: "random-order", name: "Random Order Pack", description: "Five Mystics from one surprise Order.", cardCount: 5, coinPrice: 425, theme: "Order", active: true, handlerChancePercent: 0, bonusRewardChancePercent: 0 },
  { id: "order", name: "Order Pack", description: "Choose an Order. Draw five Mystics from it.", cardCount: 5, coinPrice: 600, theme: "Order", active: true, handlerChancePercent: 0, bonusRewardChancePercent: 0 },
  { id: "void", name: "Void Pack", description: "Five Voidbound cards.", cardCount: 5, coinPrice: 700, theme: "Void", active: true, handlerChancePercent: 0, bonusRewardChancePercent: 0 },
  { id: "handler", name: "Handler Pack", description: "One guaranteed Handler.", cardCount: 1, coinPrice: 350, theme: "Handler", active: true, handlerChancePercent: 100, bonusRewardChancePercent: 0 },
] as const;

export function shouldGuaranteeAlpha(standardPacksWithoutAlpha: number) {
  return standardPacksWithoutAlpha >= 9;
}

export function nextAlphaPity(current: number, rarities: Rarity[]) {
  return rarities.includes("Alpha") ? 0 : current + 1;
}

export function weightedRarity(random = Math.random, weights = STANDARD_RARITY_WEIGHTS): Rarity {
  const roll = random() * Object.values(weights).reduce((a, b) => a + b, 0);
  let cursor = 0;
  for (const [rarity, weight] of Object.entries(weights) as [Rarity, number][]) {
    cursor += weight;
    if (roll <= cursor) return rarity;
  }
  return "Wild";
}
