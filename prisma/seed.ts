import { PrismaClient, CardKind, Rarity } from "@prisma/client";
import catalog from "../lib/data/cards.generated.json";
import { CAMPAIGN } from "../lib/client-state";
import { PACK_DEFINITIONS, STANDARD_RARITY_WEIGHTS } from "../lib/game/packs";
import { PACK_ART } from "../lib/art";

const prisma = new PrismaClient();
const rarity = (value: string) => value === "Unassigned" ? null : value.toUpperCase() as Rarity;

async function main() {
  for (const card of catalog.mystics) {
    await prisma.cardDefinition.upsert({
      where: { id: card.id },
      create: { id: card.id, kind: CardKind.MYSTIC, name: card.name, order: card.order, allegiance: card.allegiance, rarity: rarity(card.rarity), sourceRarity: card.rarity, imageFilename: card.image, mystic: { create: { power: card.power, defense: card.defense, baseAttack: card.baseAttack, rawMoves: card.moves.map((move) => move.rawText).join("; "), movesJson: card.moves, needsReview: card.moves.some((move) => move.needsReview) } } },
      update: { name: card.name, order: card.order, allegiance: card.allegiance, rarity: rarity(card.rarity), sourceRarity: card.rarity, imageFilename: card.image, mystic: { upsert: { create: { power: card.power, defense: card.defense, baseAttack: card.baseAttack, rawMoves: card.moves.map((move) => move.rawText).join("; "), movesJson: card.moves, needsReview: card.moves.some((move) => move.needsReview) }, update: { power: card.power, defense: card.defense, baseAttack: card.baseAttack, rawMoves: card.moves.map((move) => move.rawText).join("; "), movesJson: card.moves, needsReview: card.moves.some((move) => move.needsReview) } } } },
    });
  }
  for (const card of catalog.handlers) {
    await prisma.cardDefinition.upsert({
      where: { id: card.id },
      create: { id: card.id, kind: CardKind.HANDLER, name: card.name, order: card.order, allegiance: card.allegiance, rarity: rarity(card.rarity), sourceRarity: card.originalRarity, imageFilename: card.image, handler: { create: { activationRoll: `${card.activationRoll}${card.exactRoll ? "" : "+"}`, activationDice: card.activationDice, effect: card.effect, effectType: card.effectType, effectValue: card.effectValue, duration: card.duration, usageLimit: `${card.maxUses} per match`, maxUses: card.maxUses, target: card.target, notes: card.notes } } },
      update: { name: card.name, order: card.order, allegiance: card.allegiance, rarity: rarity(card.rarity), sourceRarity: card.originalRarity, imageFilename: card.image },
    });
  }
  for (const pack of PACK_DEFINITIONS) await prisma.packDefinition.upsert({ where: { id: pack.id }, create: { ...pack, poolConfig: {}, rarityWeights: STANDARD_RARITY_WEIGHTS, guaranteedSlots: {}, premiumPrice: null, eligibilityRules: {}, pityRules: pack.id === "standard" ? { rarity: "Alpha", misses: 9 } : {}, artwork: PACK_ART[pack.id] ?? null }, update: { name: pack.name, description: pack.description, cardCount: pack.cardCount, coinPrice: pack.coinPrice, theme: pack.theme, artwork: PACK_ART[pack.id] ?? null, active: pack.active } });
  await prisma.packDefinition.upsert({ where: { id: "starter" }, create: { id: "starter", name: "Starter Pack", description: "The initial account collection grant.", cardCount: 10, poolConfig: {}, rarityWeights: STANDARD_RARITY_WEIGHTS, guaranteedSlots: {}, coinPrice: 0, premiumPrice: null, eligibilityRules: { newAccountOnly: true }, pityRules: {}, theme: "Starter", artwork: null, active: false }, update: { name: "Starter Pack", cardCount: 10, active: false } });
  for (const [sortOrder, opponent] of CAMPAIGN.entries()) await prisma.campaignOpponent.upsert({ where: { id: opponent.id }, create: { id: opponent.id, name: opponent.name, difficulty: opponent.difficulty, playstyle: opponent.style, deckConfig: { size: opponent.size }, rewardConfig: { firstClearCoins: opponent.reward }, unlockLevel: opponent.level, sortOrder }, update: { name: opponent.name, difficulty: opponent.difficulty, playstyle: opponent.style, unlockLevel: opponent.level, sortOrder } });
}

main().finally(() => prisma.$disconnect());
