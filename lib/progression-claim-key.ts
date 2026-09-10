import type { PlayerState } from "./client-state";
import { progressionConfig, utcDateKey } from "./progression/state";

// Pending claims are presentation state only, never part of a saved game snapshot.
export function progressionClaimKey(state: PlayerState, tier?: number) {
  return JSON.stringify([state.account?.email, tier === undefined ? utcDateKey() : progressionConfig(state).season.id, tier ?? "dailyChallenge"]);
}
