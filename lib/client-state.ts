import catalogData from "./data/cards.generated.json";
import type { BattleState, CardCatalog, Combatant, HandlerBonuses, HandlerDefinition, MysticDefinition, PassiveEffect, Rarity } from "./game/types";
import { PACK_DEFINITIONS, nextAlphaPity, shouldGuaranteeAlpha, weightedRarity } from "./game/packs";
import { BOOST_MATCHES, stackBoost } from "./game/boosts";
import { calculateRewards, xpForLevel } from "./game/rewards";
import { rollStartingPlayer } from "./game/engine";
import { computeOrderSynergies } from "./game/order-matchups";
import { buildOrderCampaigns, findStage } from "./game/campaigns";
import { roundHalfUp } from "./game/rounding";
import { LEVEL_UP_ESSENCE_COST, MAX_MYSTIC_LEVEL, RARITY_DISMANTLE_ESSENCE, RARITY_SELL_COINS, levelBonusPercent } from "./game/economy";
import type { PlayerProfile } from "./player-profile";
import { optimizedAsset } from "./asset-url";

const sourceCatalog = catalogData as CardCatalog;
export const catalog: CardCatalog = {
  ...sourceCatalog,
  mystics: sourceCatalog.mystics.map((card) => ({ ...card, image: optimizedAsset(card.image) })),
  handlers: sourceCatalog.handlers.map((card) => ({ ...card, image: optimizedAsset(card.image) })),
};

export type OwnedCard = { id: string; definitionId: string; acquiredAt: string; level: number };
export type RewardCard = { id: string; kind: "mystic" | "handler" | "xp" | "coins" | "xpBoost" | "coinBoost"; definitionId?: string; rarity: Rarity | "Unassigned"; amount?: number; revealed: boolean };
export type PackOpening = { id: string; packId: string; name: string; cards: RewardCard[]; complete: boolean };
export type Loadout = { id: string; name: string; size: 3 | 5 | 8; mysticIds: string[]; handlerIds: string[]; active?: boolean };
export type BattleSelection = { loadoutId?: string; mysticIds?: string[]; handlerIds?: string[]; random?: boolean };
export type Binder = { id: string; name: string; cardIds: string[] };
export type ComicProgress = { pageIndex: number; completed: boolean; updatedAt: string };
export type PlayerState = {
  saveRevision: number;
  account: { email: string; username: string } | null;
  profile: PlayerProfile | null;
  level: number;
  xp: number;
  coins: number;
  premium: number;
  ownedCards: OwnedCard[];
  inventory: { id: string; type: "xp" | "coins"; rarity: Rarity; matches: number }[];
  activeBoosts: { xp: { matches: number; multiplier: 2 } | null; coins: { matches: number; multiplier: 2 } | null };
  openings: PackOpening[];
  activeOpeningId: string | null;
  loadouts: Loadout[];
  binders: Binder[];
  essence: Record<string, number>;
  campaignWins: string[];
  comicProgress: Record<string, ComicProgress>;
  wins: number;
  losses: number;
  matches: number;
  pity: number;
  battle: BattleState | null;
  battleRewarded: boolean;
  lastRewards: { xp: number; coins: number; won: boolean; campaignBonus?: number } | null;
};

export const initialState: PlayerState = {
  saveRevision: 0,
  account: null, profile: null, level: 1, xp: 0, coins: 0, premium: 0, ownedCards: [], inventory: [],
  activeBoosts: { xp: null, coins: null }, openings: [], activeOpeningId: null, loadouts: [], binders: [], essence: {},
  campaignWins: [], comicProgress: {}, wins: 0, losses: 0, matches: 0, pity: 0, battle: null, battleRewarded: false, lastRewards: null,
};

const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const randomOf = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];

const rewardRarity = (): Rarity => randomOf(["Wild", "Wild", "Hunter", "Hunter", "Predator", "Prime", "Alpha"]);

export function createRewardCard(): RewardCard {
  const kind = randomOf<RewardCard["kind"]>(["xp", "coins", "xpBoost", "coinBoost"]);
  const rarity = rewardRarity();
  if (kind === "xp") return { id: id("reward"), kind, rarity, amount: BOOST_MATCHES[rarity] * 18, revealed: false };
  if (kind === "coins") return { id: id("reward"), kind, rarity, amount: BOOST_MATCHES[rarity] * 22, revealed: false };
  return { id: id("reward"), kind, rarity, amount: BOOST_MATCHES[rarity], revealed: false };
}

function cardReward(kind: "mystic" | "handler", definition: MysticDefinition | HandlerDefinition): RewardCard {
  return { id: id("card"), kind, definitionId: definition.id, rarity: definition.rarity, revealed: false };
}

function drawMystic(rarity?: Rarity, pool = catalog.mystics) {
  const exact = rarity ? pool.filter((card) => card.rarity === rarity) : pool;
  return randomOf(exact.length ? exact : pool);
}

/**
 * Draws `count` Mystics with no duplicate `definitionId` within this one draw — a single pack
 * must never contain the same card twice. Falls back to allowing a repeat only once the pool is
 * genuinely smaller than the requested count (e.g. a niche Order/Void pool), rather than looping
 * forever chasing an impossible draw.
 */
export function drawUniqueMystics(count: number, pool: MysticDefinition[], rarityPicker: (index: number) => Rarity): MysticDefinition[] {
  const drawnIds = new Set<string>();
  const results: MysticDefinition[] = [];
  for (let index = 0; index < count; index += 1) {
    const remaining = pool.filter((card) => !drawnIds.has(card.id));
    const drawn = remaining.length ? drawMystic(rarityPicker(index), remaining) : drawMystic(undefined, pool);
    drawnIds.add(drawn.id);
    results.push(drawn);
  }
  return results;
}

function grantOpening(state: PlayerState, opening: PackOpening) {
  for (const card of opening.cards) {
    if ((card.kind === "mystic" || card.kind === "handler") && card.definitionId) state.ownedCards.push({ id: id("owned"), definitionId: card.definitionId, acquiredAt: new Date().toISOString(), level: 1 });
    if (card.kind === "xp") state.xp += card.amount ?? 0;
    if (card.kind === "coins") state.coins += card.amount ?? 0;
    if (card.kind === "xpBoost" || card.kind === "coinBoost") state.inventory.push({ id: id("boost"), type: card.kind === "xpBoost" ? "xp" : "coins", rarity: card.rarity as Rarity, matches: card.amount ?? 2 });
  }
  levelUp(state);
  state.openings.unshift(opening);
  state.activeOpeningId = opening.id;
}

export function createAccount(email: string, username: string): PlayerState {
  const state: PlayerState = structuredClone(initialState);
  state.account = { email, username };
  const starter: PackOpening = {
    id: id("opening"), packId: "starter", name: "Starter Pack", complete: false,
    cards: [cardReward("handler", randomOf(catalog.handlers)), ...drawUniqueMystics(5, catalog.mystics, () => weightedRarity()).map((m) => cardReward("mystic", m)), ...Array.from({ length: 4 }, createRewardCard)],
  };
  grantOpening(state, starter);
  return state;
}

export function buyPack(state: PlayerState, packId: string, selectedOrder?: string) {
  const pack = PACK_DEFINITIONS.find((item) => item.id === packId);
  if (!pack) throw new Error("Pack not found");
  if (state.coins < pack.coinPrice) throw new Error("Not enough Coins");
  state.coins -= pack.coinPrice;
  let cards: RewardCard[] = [];
  if (packId === "standard") {
    const forceAlpha = shouldGuaranteeAlpha(state.pity);
    const mystics = drawUniqueMystics(5, catalog.mystics, (index) => (forceAlpha && index === 0 ? "Alpha" : weightedRarity()));
    const bonusHandler = Math.random() * 100 < pack.handlerChancePercent ? [cardReward("handler", randomOf(catalog.handlers))] : [];
    const bonusReward = Math.random() * 100 < pack.bonusRewardChancePercent ? [createRewardCard()] : [];
    cards = [...mystics.map((m) => cardReward("mystic", m)), ...bonusHandler, ...bonusReward];
    state.pity = nextAlphaPity(state.pity, mystics.map((m) => m.rarity));
  } else if (packId === "handler") cards = [cardReward("handler", randomOf(catalog.handlers))];
  else {
    let pool = catalog.mystics;
    if (packId === "order") pool = pool.filter((m) => m.order === selectedOrder);
    if (packId === "random-order") { const order = randomOf([...new Set(pool.map((m) => m.order))]); pool = pool.filter((m) => m.order === order); }
    if (packId === "void") pool = pool.filter((m) => m.allegiance.toLowerCase().includes("void"));
    cards = drawUniqueMystics(5, pool, () => weightedRarity()).map((m) => cardReward("mystic", m));
  }
  grantOpening(state, { id: id("opening"), packId, name: pack.name, cards, complete: false });
}

function levelUp(state: PlayerState) {
  while (state.xp >= xpForLevel(state.level)) { state.xp -= xpForLevel(state.level); state.level += 1; state.coins += state.level % 3 === 0 ? 250 : 100; }
}

export const definitionFor = (definitionId: string) => catalog.mystics.find((m) => m.id === definitionId) ?? catalog.handlers.find((h) => h.id === definitionId);

/** Handler passives resolved once per Mystic at battle setup — never recomputed turn-to-turn ("not repeatedly compounded"). */
function resolveHandlerBonuses(mystic: MysticDefinition, handlers: HandlerDefinition[]): HandlerBonuses {
  let atkPercent = 0, defPercent = 0, powerPercent = 0, cooldownReductionPerUse = 0, cooldownReductionFloor = 1;
  const sources: string[] = [];
  const applyPassive = (passive: PassiveEffect) => {
    for (const effect of passive.effects) {
      if (effect.kind === "statModifier") {
        if (effect.stat === "atk") atkPercent += effect.percent;
        else if (effect.stat === "def") defPercent += effect.percent;
        else powerPercent += effect.percent;
      } else if (effect.kind === "cooldownReductionPerUse") {
        cooldownReductionPerUse += effect.amount;
        cooldownReductionFloor = Math.max(cooldownReductionFloor, effect.floor);
      }
    }
  };
  for (const handler of handlers) {
    let matched = false;
    if (handler.allegiance === mystic.allegiance) { applyPassive(handler.allegiancePassive); matched = true; }
    if (handler.order === mystic.order) { applyPassive(handler.orderPassive); matched = true; }
    if (matched) sources.push(handler.name);
  }
  return { atkPercent, defPercent, powerPercent, cooldownReductionPerUse, cooldownReductionFloor, sources };
}

export function combatant(owned: OwnedCard, index: number, equippedHandlers: HandlerDefinition[] = []): Combatant {
  const card = catalog.mystics.find((m) => m.id === owned.definitionId)!;
  const level = owned.level ?? 1;
  const levelMultiplier = 1 + levelBonusPercent(level) / 100;
  const handlerBonuses = resolveHandlerBonuses(card, equippedHandlers);
  const maxPower = roundHalfUp(card.power * levelMultiplier * (1 + handlerBonuses.powerPercent / 100));
  return {
    instanceId: `${owned.id}-${index}`, definitionId: card.id, name: card.name, image: card.image, rarity: card.rarity,
    order: card.order, allegiance: card.allegiance, level,
    printedPower: card.power, printedDefense: card.defense, printedBaseAttack: card.baseAttack,
    maxPower, currentPower: maxPower,
    defense: roundHalfUp(card.defense * levelMultiplier), baseAttack: roundHalfUp(card.baseAttack * levelMultiplier),
    moves: card.moves, cooldowns: {}, activeEffects: [], handlerBonuses, defeated: false,
  };
}

export const ORDER_CAMPAIGNS = buildOrderCampaigns(catalog);
export const ALL_CAMPAIGN_STAGES = ORDER_CAMPAIGNS.flatMap((campaign) => campaign.stages);

function shuffled<T>(items: T[]) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [next[index], next[swap]] = [next[swap], next[index]];
  }
  return next;
}

export function createBattle(state: PlayerState, opponentId: string, selection?: BattleSelection) {
  const { stage } = findStage(ORDER_CAMPAIGNS, opponentId) ?? findStage(ORDER_CAMPAIGNS, ALL_CAMPAIGN_STAGES[0].id)!;
  const explicitSelection = Boolean(selection?.loadoutId || selection?.mysticIds || selection?.random);
  const loadout = state.loadouts.find((item) => item.id === selection?.loadoutId && item.size === stage.size)
    ?? (!explicitSelection ? state.loadouts.find((item) => item.active && item.size === stage.size) : undefined);
  const mysticPool = state.ownedCards.filter((owned) => catalog.mystics.some((m) => m.id === owned.definitionId));
  const chosenMysticIds = selection?.mysticIds ?? loadout?.mysticIds;
  const mysticOwned = selection?.random
    ? shuffled(mysticPool).slice(0, stage.size)
    : chosenMysticIds
      ? chosenMysticIds.map((cardId) => state.ownedCards.find((owned) => owned.id === cardId)!).filter(Boolean)
      : mysticPool.slice(0, stage.size);
  if (new Set(mysticOwned.map((card) => card.id)).size !== mysticOwned.length) throw new Error("A formation cannot use the same owned card twice");
  if (mysticOwned.length !== stage.size) throw new Error(`A valid ${stage.size}-Mystic loadout is required`);
  const handlerPool = state.ownedCards.filter((owned) => catalog.handlers.some((h) => h.id === owned.definitionId));
  const chosenHandlerIds = selection?.handlerIds ?? loadout?.handlerIds;
  const handlerOwned = selection?.random
    ? shuffled(handlerPool).slice(0, 3)
    : (chosenHandlerIds ?? handlerPool.slice(0, 3).map((owned) => owned.id)).map((cardId) => state.ownedCards.find((owned) => owned.id === cardId)!).filter(Boolean);
  if (handlerOwned.length > 3 || new Set(handlerOwned.map((card) => card.id)).size !== handlerOwned.length) throw new Error("Choose no more than three different Handlers");
  const aiCards: OwnedCard[] = stage.opponentMysticIds.map((definitionId, index) => ({ id: `ai-owned-${index}`, definitionId, acquiredAt: "", level: stage.opponentLevel }));
  const aiHandlerDefs = stage.opponentHandlerId ? [catalog.handlers.find((h) => h.id === stage.opponentHandlerId)!] : [];
  const roll = rollStartingPlayer();
  const equippedHandlerDefs = handlerOwned.map((owned) => catalog.handlers.find((item) => item.id === owned.definitionId)!);
  const orderOf = (owned: OwnedCard) => catalog.mystics.find((m) => m.id === owned.definitionId)!.order;
  state.battle = {
    id: id("battle"), campaignId: stage.id, size: stage.size,
    player: { id: "player", name: state.account?.username ?? "Player", mystics: mysticOwned.map((owned, index) => combatant(owned, index, equippedHandlerDefs)), handlers: equippedHandlerDefs.map((h) => h.id), synergies: computeOrderSynergies(mysticOwned.map(orderOf)) },
    ai: { id: "ai", name: stage.opponentName, mystics: aiCards.map((owned, index) => combatant(owned, index, aiHandlerDefs)), handlers: aiHandlerDefs.map((h) => h.id), synergies: computeOrderSynergies(aiCards.map(orderOf)) },
    currentTurn: roll.first, turnNumber: 1, winner: null, lastRoll: null,
    events: [{ id: id("event"), turn: 0, type: "system", message: `${state.account?.username ?? "Player"} rolled ${roll.player}; ${stage.opponentName} rolled ${roll.ai}. ${roll.first === "player" ? "You go" : "Opponent goes"} first.` }],
  };
  state.battleRewarded = false;
  state.lastRewards = null;
}

export function rewardCompletedBattle(state: PlayerState) {
  if (!state.battle?.winner || state.battleRewarded) return;
  const won = state.battle.winner === "player";
  state.campaignWins ??= [];
  const found = findStage(ORDER_CAMPAIGNS, state.battle.campaignId ?? "");
  const firstCampaignClear = Boolean(won && found && !state.campaignWins.includes(found.stage.id));
  if (firstCampaignClear && found) state.campaignWins.push(found.stage.id);
  const player = state.battle.player.mystics;
  const enemy = state.battle.ai.mystics;
  const base = calculateRewards({ size: state.battle.size, won, defeated: enemy.filter((m) => m.defeated).length, survivors: player.filter((m) => !m.defeated).length, survivingPower: player.reduce((sum, m) => sum + m.currentPower, 0), maxPower: player.reduce((sum, m) => sum + m.maxPower, 0) });
  const repeatBonus = won && found ? found.stage.repeatReward : { coins: 0, xp: 0 };
  const firstClearBonus = firstCampaignClear && found ? found.stage.firstClearReward : { coins: 0, xp: 0, essence: 0 };
  const xp = base.xp * (state.activeBoosts.xp ? 2 : 1) + repeatBonus.xp + firstClearBonus.xp;
  const campaignBonus = firstClearBonus.coins;
  const coins = base.coins * (state.activeBoosts.coins ? 2 : 1) + repeatBonus.coins + campaignBonus;
  if (firstClearBonus.essence && found) state.essence[found.campaign.order] = (state.essence[found.campaign.order] ?? 0) + firstClearBonus.essence;
  state.xp += xp; state.coins += coins; state.matches += 1; won ? state.wins += 1 : state.losses += 1;
  for (const kind of ["xp", "coins"] as const) if (state.activeBoosts[kind]) { state.activeBoosts[kind]!.matches -= 1; if (state.activeBoosts[kind]!.matches <= 0) state.activeBoosts[kind] = null; }
  state.lastRewards = { xp, coins, won, campaignBonus }; state.battleRewarded = true; levelUp(state);
}

export function activateBoost(state: PlayerState, inventoryId: string) {
  if (state.battle && !state.battle.winner) throw new Error("Boosts cannot be activated during battle");
  const item = state.inventory.find((boost) => boost.id === inventoryId);
  if (!item) throw new Error("Boost not found");
  state.activeBoosts[item.type] = stackBoost(state.activeBoosts[item.type] ? { type: item.type, matches: state.activeBoosts[item.type]!.matches } : null, { type: item.type, matches: item.matches });
  state.inventory = state.inventory.filter((boost) => boost.id !== inventoryId);
}

function findOwnedMystic(state: PlayerState, ownedId: string) {
  const owned = state.ownedCards.find((card) => card.id === ownedId);
  if (!owned) throw new Error("Card not found");
  const mystic = catalog.mystics.find((card) => card.id === owned.definitionId);
  if (!mystic) throw new Error("Only Mystic cards can be leveled or dismantled");
  return { owned, mystic };
}

function removeOwnedCopy(state: PlayerState, ownedId: string) {
  state.ownedCards = state.ownedCards.filter((card) => card.id !== ownedId);
  state.binders.forEach((binder) => { binder.cardIds = binder.cardIds.filter((cardId) => cardId !== ownedId); });
}

/** Coins granted for a duplicate Mystic or Handler. Requires owning at least 2 copies of that definition. */
export function sellDuplicateCard(state: PlayerState, ownedId: string) {
  const owned = state.ownedCards.find((card) => card.id === ownedId);
  if (!owned) throw new Error("Card not found");
  const copies = state.ownedCards.filter((card) => card.definitionId === owned.definitionId);
  if (copies.length < 2) throw new Error("Only duplicate copies can be sold");
  const definition = definitionFor(owned.definitionId)!;
  removeOwnedCopy(state, ownedId);
  state.coins += RARITY_SELL_COINS[definition.rarity];
}

/** Destroys a duplicate Mystic, granting Order Essence matching its Order. Mystics only, per spec. */
export function dismantleCard(state: PlayerState, ownedId: string) {
  const { owned, mystic } = findOwnedMystic(state, ownedId);
  const copies = state.ownedCards.filter((card) => card.definitionId === owned.definitionId);
  if (copies.length < 2) throw new Error("Only duplicate copies can be dismantled");
  removeOwnedCopy(state, ownedId);
  state.essence[mystic.order] = (state.essence[mystic.order] ?? 0) + RARITY_DISMANTLE_ESSENCE[mystic.rarity];
}

/** Toggles a loadout active for its battle size, deactivating any other loadout of the same size (only one active loadout per size). */
export function setActiveLoadout(state: PlayerState, id: string) {
  const target = state.loadouts.find((item) => item.id === id);
  if (!target) return;
  const activating = !target.active;
  for (const loadout of state.loadouts) {
    if (loadout.id === id) loadout.active = activating;
    else if (loadout.size === target.size) loadout.active = false;
  }
}

/** Levels a specific owned Mystic instance up by exactly one level, spending that Order's Essence. */
export function levelUpCard(state: PlayerState, ownedId: string) {
  const { owned, mystic } = findOwnedMystic(state, ownedId);
  if (owned.level >= MAX_MYSTIC_LEVEL) throw new Error(`${mystic.name} is already at the maximum level`);
  const cost = LEVEL_UP_ESSENCE_COST[owned.level + 1];
  const available = state.essence[mystic.order] ?? 0;
  if (available < cost) throw new Error(`Not enough ${mystic.order} Essence — need ${cost}, have ${available}`);
  state.essence[mystic.order] = available - cost;
  owned.level += 1;
}
