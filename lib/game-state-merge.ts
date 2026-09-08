import type { PlayerState } from "./client-state";

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
  state.campaignWins = [...new Set([...cloud.campaignWins, ...local.campaignWins])];
  const cloudNeedsUpdate = selected === local
    || state.campaignWins.some((stageId) => !cloud.campaignWins.includes(stageId));
  return { state, cloudNeedsUpdate };
}
