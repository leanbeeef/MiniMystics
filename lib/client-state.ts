import catalogData from "./data/cards.generated.json";
import type { BattleState, CardCatalog, Combatant, HandlerDefinition, MysticDefinition, Rarity } from "./game/types";
import { PACK_DEFINITIONS, nextAlphaPity, shouldGuaranteeAlpha, weightedRarity } from "./game/packs";
import { BOOST_MATCHES, stackBoost } from "./game/boosts";
import { calculateRewards, xpForLevel } from "./game/rewards";
import { rollStartingPlayer } from "./game/engine";
import type { PlayerProfile } from "./player-profile";
import { optimizedAsset } from "./asset-url";

const sourceCatalog = catalogData as CardCatalog;
export const catalog: CardCatalog = {
  ...sourceCatalog,
  mystics: sourceCatalog.mystics.map((card) => ({ ...card, image: optimizedAsset(card.image) })),
  handlers: sourceCatalog.handlers.map((card) => ({ ...card, image: optimizedAsset(card.image) })),
};

export type OwnedCard = { id: string; definitionId: string; acquiredAt: string };
export type RewardCard = { id: string; kind: "mystic" | "handler" | "xp" | "coins" | "xpBoost" | "coinBoost"; definitionId?: string; rarity: Rarity | "Unassigned"; amount?: number; revealed: boolean };
export type PackOpening = { id: string; packId: string; name: string; cards: RewardCard[]; complete: boolean };
export type Loadout = { id: string; name: string; size: 3 | 5 | 8; mysticIds: string[]; handlerIds: string[] };
export type BattleSelection = { loadoutId?: string; mysticIds?: string[]; handlerIds?: string[]; random?: boolean };
export type Binder = { id: string; name: string; cardIds: string[] };
export type ComicProgress = { pageIndex: number; completed: boolean; updatedAt: string };
export type PlayerState = {
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
  account: null, profile: null, level: 1, xp: 0, coins: 0, premium: 0, ownedCards: [], inventory: [],
  activeBoosts: { xp: null, coins: null }, openings: [], activeOpeningId: null, loadouts: [], binders: [],
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

function grantOpening(state: PlayerState, opening: PackOpening) {
  for (const card of opening.cards) {
    if ((card.kind === "mystic" || card.kind === "handler") && card.definitionId) state.ownedCards.push({ id: id("owned"), definitionId: card.definitionId, acquiredAt: new Date().toISOString() });
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
    cards: [cardReward("handler", randomOf(catalog.handlers)), ...Array.from({ length: 5 }, () => cardReward("mystic", drawMystic())), ...Array.from({ length: 4 }, createRewardCard)],
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
    const mystics = Array.from({ length: 5 }, (_, index) => drawMystic(forceAlpha && index === 0 ? "Alpha" : weightedRarity()));
    cards = [cardReward("handler", randomOf(catalog.handlers)), ...mystics.map((m) => cardReward("mystic", m)), ...Array.from({ length: 4 }, createRewardCard)];
    state.pity = nextAlphaPity(state.pity, mystics.map((m) => m.rarity));
  } else if (packId === "handler") cards = [cardReward("handler", randomOf(catalog.handlers))];
  else {
    let pool = catalog.mystics;
    if (packId === "order") pool = pool.filter((m) => m.order === selectedOrder);
    if (packId === "random-order") { const order = randomOf([...new Set(pool.map((m) => m.order))]); pool = pool.filter((m) => m.order === order); }
    if (packId === "void") pool = pool.filter((m) => m.allegiance.toLowerCase().includes("void"));
    cards = Array.from({ length: 5 }, () => cardReward("mystic", drawMystic(weightedRarity(), pool)));
  }
  grantOpening(state, { id: id("opening"), packId, name: pack.name, cards, complete: false });
}

function levelUp(state: PlayerState) {
  while (state.xp >= xpForLevel(state.level)) { state.xp -= xpForLevel(state.level); state.level += 1; state.coins += state.level % 3 === 0 ? 250 : 100; }
}

export const definitionFor = (definitionId: string) => catalog.mystics.find((m) => m.id === definitionId) ?? catalog.handlers.find((h) => h.id === definitionId);

export function combatant(owned: OwnedCard, index: number): Combatant {
  const card = catalog.mystics.find((m) => m.id === owned.definitionId)!;
  return { instanceId: `${owned.id}-${index}`, definitionId: card.id, name: card.name, image: card.image, rarity: card.rarity, order: card.order, maxPower: card.power, currentPower: card.power, defense: card.defense, baseAttack: card.baseAttack, moves: card.moves, cooldowns: {}, effects: [], defeated: false };
}

export const CAMPAIGN = [
  { id: "rookie", name: "Lio of the Lowlands", difficulty: "Easy", style: "Balanced", level: 1, size: 3 as const, reward: 90 },
  { id: "forge", name: "Mara Ironhand", difficulty: "Easy", style: "Defensive", level: 1, size: 5 as const, reward: 135 },
  { id: "gale", name: "Aster Gale", difficulty: "Medium", style: "Aggressive", level: 2, size: 5 as const, reward: 180 },
  { id: "veil", name: "Nox of Moonveil", difficulty: "Medium", style: "Control", level: 3, size: 5 as const, reward: 220 },
  { id: "regent", name: "The Silver Regent", difficulty: "Hard", style: "Finishers", level: 4, size: 8 as const, reward: 320 },
  { id: "fallen", name: "Arch, The Fallen", difficulty: "Hard", style: "Void control", level: 6, size: 8 as const, reward: 500 },
];

function shuffled<T>(items: T[]) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [next[index], next[swap]] = [next[swap], next[index]];
  }
  return next;
}

export function createBattle(state: PlayerState, opponentId: string, selection?: BattleSelection) {
  const opponent = CAMPAIGN.find((item) => item.id === opponentId) ?? CAMPAIGN[0];
  const loadout = state.loadouts.find((item) => item.id === selection?.loadoutId && item.size === opponent.size);
  const mysticPool = state.ownedCards.filter((owned) => catalog.mystics.some((m) => m.id === owned.definitionId));
  const chosenMysticIds = selection?.mysticIds ?? loadout?.mysticIds;
  const mysticOwned = selection?.random
    ? shuffled(mysticPool).slice(0, opponent.size)
    : chosenMysticIds
      ? chosenMysticIds.map((cardId) => state.ownedCards.find((owned) => owned.id === cardId)!).filter(Boolean)
      : mysticPool.slice(0, opponent.size);
  if (new Set(mysticOwned.map((card) => card.id)).size !== mysticOwned.length) throw new Error("A formation cannot use the same owned card twice");
  if (mysticOwned.length !== opponent.size) throw new Error(`A valid ${opponent.size}-Mystic loadout is required`);
  const handlerPool = state.ownedCards.filter((owned) => catalog.handlers.some((h) => h.id === owned.definitionId));
  const chosenHandlerIds = selection?.handlerIds ?? loadout?.handlerIds;
  const handlerOwned = selection?.random
    ? shuffled(handlerPool).slice(0, 3)
    : (chosenHandlerIds ?? handlerPool.slice(0, 3).map((owned) => owned.id)).map((cardId) => state.ownedCards.find((owned) => owned.id === cardId)!).filter(Boolean);
  if (handlerOwned.length > 3 || new Set(handlerOwned.map((card) => card.id)).size !== handlerOwned.length) throw new Error("Choose no more than three different Handlers");
  const aiPool = [...catalog.mystics].sort((a, b) => a.power + a.defense + a.baseAttack - (b.power + b.defense + b.baseAttack));
  const start = opponent.difficulty === "Hard" ? Math.max(0, aiPool.length - opponent.size * 2) : opponent.difficulty === "Medium" ? Math.floor(aiPool.length / 2) : 0;
  const aiCards = aiPool.slice(start, start + opponent.size).map((card, index) => ({ id: `ai-owned-${index}`, definitionId: card.id, acquiredAt: "" }));
  const roll = rollStartingPlayer();
  const handlers = (cards: OwnedCard[]) => cards.map((owned) => { const h = catalog.handlers.find((item) => item.id === owned.definitionId)!; return { definitionId: h.id, name: h.name, uses: 0, maxUses: h.maxUses, activationRoll: h.activationRoll, exactRoll: h.exactRoll, effectType: h.effectType }; });
  state.battle = { id: id("battle"), campaignId: opponent.id, size: opponent.size, player: { id: "player", name: state.account?.username ?? "Player", mystics: mysticOwned.map(combatant), handlers: handlers(handlerOwned) }, ai: { id: "ai", name: opponent.name, mystics: aiCards.map(combatant), handlers: [] }, currentTurn: roll.first, turnNumber: 1, winner: null, lastRoll: null, events: [{ id: id("event"), turn: 0, type: "system", message: `${state.account?.username ?? "Player"} rolled ${roll.player}; ${opponent.name} rolled ${roll.ai}. ${roll.first === "player" ? "You go" : "Opponent goes"} first.` }] };
  state.battleRewarded = false;
  state.lastRewards = null;
}

export function rewardCompletedBattle(state: PlayerState) {
  if (!state.battle?.winner || state.battleRewarded) return;
  const won = state.battle.winner === "player";
  state.campaignWins ??= [];
  const campaign = CAMPAIGN.find((opponent) => opponent.id === state.battle?.campaignId || opponent.name === state.battle?.ai.name);
  const firstCampaignClear = Boolean(won && campaign && !state.campaignWins.includes(campaign.id));
  if (firstCampaignClear && campaign) state.campaignWins.push(campaign.id);
  const player = state.battle.player.mystics;
  const enemy = state.battle.ai.mystics;
  const base = calculateRewards({ size: state.battle.size, won, defeated: enemy.filter((m) => m.defeated).length, survivors: player.filter((m) => !m.defeated).length, survivingPower: player.reduce((sum, m) => sum + m.currentPower, 0), maxPower: player.reduce((sum, m) => sum + m.maxPower, 0) });
  const xp = base.xp * (state.activeBoosts.xp ? 2 : 1);
  const campaignBonus = firstCampaignClear ? campaign?.reward ?? 0 : 0;
  const coins = base.coins * (state.activeBoosts.coins ? 2 : 1) + campaignBonus;
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
