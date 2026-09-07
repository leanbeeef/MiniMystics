import { ORDERS, type Order } from "./order-matchups";
import type { CardCatalog, HandlerDefinition, MysticDefinition } from "./types";

export type AiLogicProfile = "balanced" | "aggressive" | "defensive";

export type CampaignStage = {
  id: string;
  stageNumber: number;
  name: string;
  difficulty: "Easy" | "Medium" | "Hard" | "Elite";
  size: 3 | 5 | 8;
  opponentName: string;
  opponentLevel: number;
  opponentMysticIds: string[];
  opponentHandlerId: string | null;
  aiLogicProfile: AiLogicProfile;
  firstClearReward: { coins: number; xp: number; essence: number };
  repeatReward: { coins: number; xp: number };
  unlockRequirement: { previousStageId: string | null; minPlayerLevel: number };
};

export type Campaign = { order: Order; name: string; description: string; stages: CampaignStage[] };

const STAGE_COUNT = 5;
const SIZES: Array<3 | 5 | 8> = [3, 3, 5, 5, 8];
const LEVELS = [1, 3, 5, 7, 10];
const DIFFICULTIES: CampaignStage["difficulty"][] = ["Easy", "Easy", "Medium", "Hard", "Elite"];
const AI_PROFILES: AiLogicProfile[] = ["balanced", "aggressive", "defensive"];
const MIN_PLAYER_LEVELS = [1, 1, 2, 4, 6];

const statTotal = (card: MysticDefinition) => card.power + card.defense + card.baseAttack;

/**
 * Deterministic (no randomness — stage identity must be stable across app loads) roster
 * builder. Draws primarily from the campaign's own Order, sliding the "power window" up as
 * stages progress so later stages field that Order's stronger Mystics — this is how rarity and
 * team strength scale without simply inflating a flat Power Score multiplier. Falls back to the
 * next-nearest Orders only when an Order's own roster is smaller than the stage's team size
 * (e.g. Agespire has 7 Mystics total, one short of an 8-Mystic final stage).
 */
function buildStageRoster(catalog: CardCatalog, order: Order, size: number, stageIndex: number): MysticDefinition[] {
  const sameOrder = [...catalog.mystics.filter((card) => card.order === order)].sort((a, b) => statTotal(a) - statTotal(b));
  const others = [...catalog.mystics.filter((card) => card.order !== order)].sort((a, b) => statTotal(a) - statTotal(b));
  const span = Math.max(0, sameOrder.length - size);
  const windowStart = Math.round(span * (stageIndex / (STAGE_COUNT - 1)));
  const fromOwnOrder = sameOrder.slice(windowStart, windowStart + size);
  if (fromOwnOrder.length >= size) return fromOwnOrder;
  return [...fromOwnOrder, ...others.slice(0, size - fromOwnOrder.length)];
}

/** A Handler whose Order or Allegiance passive matches this campaign's Order/roster, if one exists — AI opponents get none today; this is a real upgrade over that. */
function pickCampaignHandler(catalog: CardCatalog, order: Order, roster: MysticDefinition[]): HandlerDefinition | null {
  const orderMatch = catalog.handlers.find((handler) => handler.order === order);
  if (orderMatch) return orderMatch;
  const rosterAllegiances = new Set(roster.map((card) => card.allegiance));
  return catalog.handlers.find((handler) => rosterAllegiances.has(handler.allegiance)) ?? null;
}

function buildCampaign(catalog: CardCatalog, order: Order): Campaign {
  const stages: CampaignStage[] = [];
  let previousStageId: string | null = null;
  for (let index = 0; index < STAGE_COUNT; index += 1) {
    const size = SIZES[index];
    const roster = buildStageRoster(catalog, order, size, index);
    const handler = pickCampaignHandler(catalog, order, roster);
    const stageNumber = index + 1;
    const id = `${order.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-stage-${stageNumber}`;
    const rewardScale = stageNumber * (index === STAGE_COUNT - 1 ? 1.6 : 1);
    stages.push({
      id, stageNumber, name: `${order} — Stage ${stageNumber}`, difficulty: DIFFICULTIES[index], size,
      opponentName: `${order} Vanguard ${stageNumber}`, opponentLevel: LEVELS[index],
      opponentMysticIds: roster.map((card) => card.id), opponentHandlerId: handler?.id ?? null,
      aiLogicProfile: AI_PROFILES[index % AI_PROFILES.length],
      firstClearReward: { coins: Math.round(90 * rewardScale), xp: Math.round(45 * rewardScale), essence: Math.round(30 * rewardScale) },
      repeatReward: { coins: Math.round(35 * rewardScale), xp: Math.round(18 * rewardScale) },
      unlockRequirement: { previousStageId, minPlayerLevel: MIN_PLAYER_LEVELS[index] },
    });
    previousStageId = id;
  }
  return { order, name: `${order} Campaign`, description: `Rise through five Vanguard stages built entirely from ${order}'s own Mystics.`, stages };
}

/** Builds all 10 Order campaigns from a card catalog. One generator, not ten hardcoded systems. Deterministic — safe to call repeatedly (e.g. once per module load) and always yields the same stage ids. */
export function buildOrderCampaigns(catalog: CardCatalog): Campaign[] {
  return ORDERS.map((order) => buildCampaign(catalog, order));
}

export function findStage(campaigns: Campaign[], stageId: string): { campaign: Campaign; stage: CampaignStage } | undefined {
  for (const campaign of campaigns) {
    const stage = campaign.stages.find((item) => item.id === stageId);
    if (stage) return { campaign, stage };
  }
  return undefined;
}

export function isStageUnlocked(stage: CampaignStage, playerLevel: number, campaignWins: string[]): boolean {
  if (playerLevel < stage.unlockRequirement.minPlayerLevel) return false;
  return stage.unlockRequirement.previousStageId === null || campaignWins.includes(stage.unlockRequirement.previousStageId);
}
