import type { PlayerState } from "./client-state";
import { reconcileAdminBalance } from "./admin-balance";

export type HydrationSelection = {
  state: PlayerState;
  cloudNeedsUpdate: boolean;
};

function revision(state: PlayerState) {
  return Number.isSafeInteger(state.saveRevision) && state.saveRevision >= 0 ? state.saveRevision : 0;
}

function containsEvery<T>(candidate: Set<T>, required: Set<T>) {
  for (const value of required) if (!candidate.has(value)) return false;
  return true;
}

function revealedCards(state: PlayerState) {
  return state.openings.reduce((total, opening) => total + opening.cards.filter((card) => card.revealed).length, 0);
}

function laterTimestamp(first: string | null, second: string | null) {
  if (!first) return second;
  if (!second) return first;
  return Date.parse(first) >= Date.parse(second) ? first : second;
}

function mergeAuthoritativeProgression(state: PlayerState, cloud: PlayerState) {
  state.progression.lastDailyPackClaimAt = laterTimestamp(
    state.progression.lastDailyPackClaimAt,
    cloud.progression.lastDailyPackClaimAt,
  );
  state.progression.configuration = cloud.progression.configuration ?? state.progression.configuration;

  for (const [seasonId, cloudProgress] of Object.entries(cloud.progression.seasons)) {
    const progress = state.progression.seasons[seasonId];
    if (!progress) {
      state.progression.seasons[seasonId] = structuredClone(cloudProgress);
      continue;
    }
    progress.seasonXp = Math.max(progress.seasonXp, cloudProgress.seasonXp);
    progress.currentTier = Math.max(progress.currentTier, cloudProgress.currentTier);
    progress.claimedTiers = [...new Set([...progress.claimedTiers, ...cloudProgress.claimedTiers])];
    if (cloudProgress.lastBattleBonusDate && (!progress.lastBattleBonusDate || cloudProgress.lastBattleBonusDate > progress.lastBattleBonusDate)) {
      progress.lastBattleBonusDate = cloudProgress.lastBattleBonusDate;
    }
  }

  for (const [challengeDate, cloudProgress] of Object.entries(cloud.progression.dailyChallenges)) {
    const progress = state.progression.dailyChallenges[challengeDate];
    if (!progress) {
      state.progression.dailyChallenges[challengeDate] = structuredClone(cloudProgress);
      continue;
    }
    progress.completed ||= cloudProgress.completed;
    progress.rewardClaimed ||= cloudProgress.rewardClaimed;
    progress.completedAt ??= cloudProgress.completedAt;
  }
}

/**
 * Selects the newest durable snapshot during sign-in hydration. `saveRevision` handles all new
 * saves; the opening/campaign checks recover progress created by builds that predate revisions.
 */
export function selectHydratedGameState(local: PlayerState, cloud: PlayerState | null): HydrationSelection {
  if (!cloud) return { state: structuredClone(local), cloudNeedsUpdate: true };

  const localRevision = revision(local);
  const cloudRevision = revision(cloud);
  let selected = cloud;

  if (localRevision > cloudRevision) selected = local;
  else if (localRevision === cloudRevision) {
    const localOpeningIds = new Set(local.openings.map((opening) => opening.id));
    const cloudOpeningIds = new Set(cloud.openings.map((opening) => opening.id));
    const localContainsCloudOpenings = containsEvery(localOpeningIds, cloudOpeningIds);
    const cloudContainsLocalOpenings = containsEvery(cloudOpeningIds, localOpeningIds);

    if (localContainsCloudOpenings && localOpeningIds.size > cloudOpeningIds.size) selected = local;
    else if (cloudContainsLocalOpenings && cloudOpeningIds.size > localOpeningIds.size) selected = cloud;
    else if (localContainsCloudOpenings && cloudContainsLocalOpenings && revealedCards(local) > revealedCards(cloud)) selected = local;
    else {
      const localWins = new Set(local.campaignWins);
      const cloudWins = new Set(cloud.campaignWins);
      if (containsEvery(localWins, cloudWins) && localWins.size > cloudWins.size) selected = local;
    }
  }

  const state = structuredClone(selected);
  if (cloud.adminBalanceTotals) reconcileAdminBalance(state, cloud.adminBalanceTotals);
  state.campaignWins = [...new Set([...cloud.campaignWins, ...local.campaignWins])];
  mergeAuthoritativeProgression(state, cloud);
  const cloudNeedsUpdate = selected === local
    || state.campaignWins.some((stageId) => !cloud.campaignWins.includes(stageId));
  return { state, cloudNeedsUpdate };
}
