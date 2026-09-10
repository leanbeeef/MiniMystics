import { BOOST_MATCHES } from "../game/boosts";
import type { Rarity } from "../game/types";
import { DAILY_CHALLENGES, DAILY_ROTATION_EPOCH, SEASON_ONE, SEASON_ONE_REWARDS, SEASON_TIER_THRESHOLDS, SEASON_XP_SOURCES, type ChallengeRequirement, type ProgressMetric, type SeasonReward } from "./config";

export type ProgressEvent = {
  type: "BATTLE_STARTED" | "BATTLE_COMPLETED" | "BATTLE_WON" | "BATTLE_LOST" | "ATTACK_LANDED" | "DAMAGE_DEALT" | "SPECIAL_ATTEMPTED" | "SPECIAL_SUCCEEDED" | "HANDLER_SUCCEEDED";
  battleId?: string; value?: number; attackKind?: "basic" | "special"; actorOrder?: string; teamOrders?: string[]; teamSize?: number;
  survivors?: number; defeatedAllies?: number; maxSurvivorPowerPercent?: number; lineupKey?: string;
};
export type ChallengeProgress = {
  challengeId: string; challengeDate: string; values: Record<string, number>; sets: Record<string, string[]>;
  battleValues: Record<string, Record<string, number>>; completed: boolean; rewardClaimed: boolean; completedAt?: string;
};
export type SeasonProgress = { seasonId: string; seasonXp: number; currentTier: number; claimedTiers: number[]; lastBattleBonusDate?: string; updatedAt: string };
export type PlayerProgression = {
  lastDailyPackClaimAt: string | null;
  dailyChallenges: Record<string, ChallengeProgress>;
  seasons: Record<string, SeasonProgress>;
  notifications: { id: string; kind: "dailyPack" | "challenge" | "tier" | "season"; message: string; createdAt: string; read: boolean }[];
  configuration?: RuntimeProgressionConfig;
};
export type RuntimeProgressionConfig = {
  challenges: typeof DAILY_CHALLENGES;
  season: { id: string; number: number; name: string; startsAt: string; endsAt: string; xpSources: { battleComplete: number; battleWin: number; firstBattleOfDay: number }; thresholds: number[]; rewards: SeasonReward[] };
};

export type ProgressionState = {
  progression: PlayerProgression;
  coins: number;
  ownedCards: { id: string; definitionId: string; acquiredAt: string; level: number; variant?: string; artworkVariant?: string; seasonOrigin?: string }[];
  inventory: { id: string; type: "xp" | "coins"; rarity: Rarity; matches: number }[];
};

export const defaultProgressionConfig = (): RuntimeProgressionConfig => ({ challenges: structuredClone(DAILY_CHALLENGES), season: { ...SEASON_ONE, xpSources: { ...SEASON_XP_SOURCES }, thresholds: [...SEASON_TIER_THRESHOLDS], rewards: structuredClone(SEASON_ONE_REWARDS) } });
export const emptyProgression = (): PlayerProgression => ({ lastDailyPackClaimAt: null, dailyChallenges: {}, seasons: {}, notifications: [], configuration: defaultProgressionConfig() });
export const progressionConfig = (state: ProgressionState) => state.progression.configuration ?? defaultProgressionConfig();
export const utcDateKey = (date = new Date()) => date.toISOString().slice(0, 10);
export function dailyChallengeIndex(date = new Date(), count = 30) {
  const elapsed = Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - Date.parse(DAILY_ROTATION_EPOCH)) / 86_400_000);
  return ((elapsed % count) + count) % count;
}
export const challengeForDate = (date = new Date(), challenges = DAILY_CHALLENGES) => challenges[dailyChallengeIndex(date, challenges.length)];
export const nextUtcDay = (date = new Date()) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1));
export const seasonActive = (
  date = new Date(),
  season: { startsAt: string; endsAt: string } = SEASON_ONE,
) => date >= new Date(season.startsAt) && date < new Date(season.endsAt);
export const tierForXp = (xp: number, thresholds = SEASON_TIER_THRESHOLDS) => thresholds.reduce((tier, threshold, index) => xp >= threshold ? index + 1 : tier, 1);
export const dailyPackAvailableAt = (lastClaim: string | null) => lastClaim ? new Date(Date.parse(lastClaim) + 86_400_000) : null;
export const isDailyPackAvailable = (lastClaim: string | null, date = new Date()) => !lastClaim || date >= dailyPackAvailableAt(lastClaim)!;

function progressFor(state: ProgressionState, now: Date) {
  state.progression ??= emptyProgression();
  const key = utcDateKey(now); const challenge = challengeForDate(now, progressionConfig(state).challenges);
  return state.progression.dailyChallenges[key] ??= { challengeId: challenge.id, challengeDate: key, values: {}, sets: {}, battleValues: {}, completed: false, rewardClaimed: false };
}
export function seasonProgressFor(state: ProgressionState, now = new Date()) {
  state.progression ??= emptyProgression();
  const season = progressionConfig(state).season;
  return state.progression.seasons[season.id] ??= { seasonId: season.id, seasonXp: 0, currentTier: 1, claimedTiers: [], updatedAt: now.toISOString() };
}
function notify(state: ProgressionState, kind: PlayerProgression["notifications"][number]["kind"], id: string, message: string, now: Date) {
  if (state.progression.notifications.some(item => item.id === id)) return;
  state.progression.notifications.unshift({ id, kind, message, createdAt: now.toISOString(), read: false });
  state.progression.notifications = state.progression.notifications.slice(0, 30);
}
function qualifies(requirement: ChallengeRequirement, event: ProgressEvent) {
  if (requirement.order && event.type !== "BATTLE_WON" && event.actorOrder !== requirement.order) return false;
  const orders = event.teamOrders ?? [];
  if (requirement.teamSize && event.teamSize !== requirement.teamSize) return false;
  if (requirement.onlyOrder && (!orders.length || orders.some(order => order !== requirement.onlyOrder))) return false;
  if (requirement.order && requirement.metric === "battleWon" && orders.filter(order => order === requirement.order).length < (requirement.minOrderCount ?? 1)) return false;
  if (requirement.minOrderCount && requirement.onlyOrder && orders.length < requirement.minOrderCount) return false;
  if (requirement.minSurvivors && (event.survivors ?? 0) < requirement.minSurvivors) return false;
  if (requirement.requireAllyDefeated && !(event.defeatedAllies ?? 0)) return false;
  if (requirement.minSurvivorPowerPercent && (event.maxSurvivorPowerPercent ?? 0) < requirement.minSurvivorPowerPercent) return false;
  return true;
}
const eventMetric: Partial<Record<ProgressEvent["type"], ProgressMetric>> = {
  BATTLE_COMPLETED: "battleCompleted", BATTLE_WON: "battleWon", SPECIAL_ATTEMPTED: "specialAttempted",
  SPECIAL_SUCCEEDED: "specialSucceeded", HANDLER_SUCCEEDED: "handlerSucceeded", DAMAGE_DEALT: "damageDealt", ATTACK_LANDED: "attackLanded",
};

export function addSeasonXp(state: ProgressionState, amount: number, now = new Date()) {
  const config = progressionConfig(state);
  if (!seasonActive(now, config.season) || amount <= 0) return;
  const season = seasonProgressFor(state, now); const previousTier = season.currentTier;
  season.seasonXp = Math.max(0, season.seasonXp + amount); season.currentTier = tierForXp(season.seasonXp, config.season.thresholds); season.updatedAt = now.toISOString();
  if (season.currentTier > previousTier) notify(state, "tier", `tier:${config.season.id}:${season.currentTier}`, `Season Pass Tier ${season.currentTier} unlocked.`, now);
}

export function applyProgressEvent(state: ProgressionState, event: ProgressEvent, now = new Date()) {
  const config = progressionConfig(state); const challenge = challengeForDate(now, config.challenges); const progress = progressFor(state, now); const metric = eventMetric[event.type];
  if (event.type === "BATTLE_STARTED") {
    const values = progress.sets.distinctOrders ??= [];
    for (const order of event.teamOrders ?? []) if (!values.includes(order)) values.push(order);
  }
  if (event.type === "BATTLE_LOST") progress.values.winStreak = 0;
  if (event.type === "BATTLE_WON") {
    progress.values.winStreak = (progress.values.winStreak ?? 0) + 1;
    if (event.lineupKey) { const values = progress.sets.uniqueWinningLineups ??= []; if (!values.includes(event.lineupKey)) values.push(event.lineupKey); }
  }
  if (event.type === "BATTLE_COMPLETED") {
    const season = seasonProgressFor(state, now);
    addSeasonXp(state, config.season.xpSources.battleComplete, now);
    if (season.lastBattleBonusDate !== utcDateKey(now)) { season.lastBattleBonusDate = utcDateKey(now); addSeasonXp(state, config.season.xpSources.firstBattleOfDay, now); }
  }
  if (event.type === "BATTLE_WON") addSeasonXp(state, config.season.xpSources.battleWin, now);
  if (metric) {
    for (const requirement of challenge.requirements.filter(item => item.metric === metric && qualifies(item, event))) {
      const amount = event.value ?? 1;
      if (requirement.singleBattle && event.battleId) {
        const battle = progress.battleValues[event.battleId] ??= {};
        battle[metric] = (battle[metric] ?? 0) + amount;
        progress.values[metric] = Math.max(progress.values[metric] ?? 0, battle[metric]);
      } else progress.values[metric] = (progress.values[metric] ?? 0) + amount;
    }
  }
  if (event.type === "ATTACK_LANDED" && event.attackKind === "basic") progress.values.basicLanded = (progress.values.basicLanded ?? 0) + 1;
  progress.values.distinctOrders = progress.sets.distinctOrders?.length ?? 0;
  progress.values.uniqueWinningLineups = progress.sets.uniqueWinningLineups?.length ?? 0;
  const completed = challenge.requirements.every(item => (progress.values[item.metric] ?? 0) >= item.target);
  if (completed && !progress.completed) { progress.completed = true; progress.completedAt = now.toISOString(); notify(state, "challenge", `challenge:${progress.challengeDate}`, `${challenge.name} complete. Claim your reward.`, now); }
}

export function claimDailyChallenge(state: ProgressionState, now = new Date()) {
  const challenge = challengeForDate(now, progressionConfig(state).challenges); const progress = progressFor(state, now);
  if (!progress.completed) throw new Error("Daily Challenge is not complete");
  if (progress.rewardClaimed) throw new Error("Daily Challenge reward already claimed");
  progress.rewardClaimed = true; state.coins += challenge.coins; addSeasonXp(state, challenge.seasonXp, now);
}

export function claimSeasonTier(state: ProgressionState, tier: number, grantPack: () => void, now = new Date(), reward: SeasonReward = progressionConfig(state).season.rewards[tier - 1]) {
  const config = progressionConfig(state); const progress = seasonProgressFor(state, now);
  if (tier < 1 || tier > config.season.rewards.length || progress.currentTier < tier) throw new Error("Season tier is locked");
  if (progress.claimedTiers.includes(tier)) throw new Error("Season reward already claimed");
  if (!reward || reward.type.endsWith("Placeholder")) throw new Error("This card reward is coming before Season launch");
  if (reward.type === "coins") state.coins += reward.amount ?? 0;
  else if (reward.type === "standardPack") grantPack();
  else if (reward.type === "mystic" || reward.type === "illustrationRare") {
    if (!reward.definitionId) throw new Error("This Season card reward has not been configured");
    state.ownedCards.push({
      id: `season-card-${config.season.id}-${tier}-${Date.now()}`,
      definitionId: reward.definitionId,
      acquiredAt: now.toISOString(),
      level: 1,
      variant: reward.type,
      artworkVariant: reward.artworkVariant ?? (reward.type === "illustrationRare" ? `season-${config.season.id}` : "default"),
      seasonOrigin: config.season.id,
    });
  } else state.inventory.push({ id: `season-${config.season.id}-${tier}-${Date.now()}`, type: reward.type === "xpBoost" ? "xp" : "coins", rarity: "Prime", matches: BOOST_MATCHES.Prime });
  progress.claimedTiers.push(tier); progress.updatedAt = now.toISOString();
}

export function dismissNotification(state: ProgressionState, id: string) {
  const notification = state.progression.notifications.find(item => item.id === id); if (notification) notification.read = true;
}

export function ensureRetentionNotifications(state: ProgressionState, now = new Date()) {
  state.progression ??= emptyProgression(); const before = state.progression.notifications.length;
  if (isDailyPackAvailable(state.progression.lastDailyPackClaimAt, now)) notify(state, "dailyPack", `daily-pack:${state.progression.lastDailyPackClaimAt ?? "first"}`, "Your free Daily Pack is ready.", now);
  const season = progressionConfig(state).season; const remaining = Math.ceil((Date.parse(season.endsAt) - now.getTime()) / 86_400_000);
  if (remaining > 0 && remaining <= 3) notify(state, "season", `season-ending:${season.id}`, `${season.name} ends in ${remaining} day${remaining === 1 ? "" : "s"}.`, now);
  return state.progression.notifications.length !== before;
}
