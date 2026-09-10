import type { PlayerState } from "./client-state";
import { getSupabaseAccessToken } from "./supabase";

export type GameActivityType =
  | "SESSION_STARTED"
  | "PROFILE_UPDATED"
  | "COMIC_PROGRESS_SAVED"
  | "PACK_PURCHASED"
  | "PACK_REVEALED"
  | "BOOST_ACTIVATED"
  | "LOADOUT_SAVED"
  | "LOADOUT_DELETED"
  | "LOADOUT_ACTIVATED"
  | "BINDER_CREATED"
  | "BINDER_RENAMED"
  | "BINDER_CARD_TOGGLED"
  | "CARD_SOLD"
  | "CARD_DISMANTLED"
  | "CARD_LEVELED_UP"
  | "BATTLE_STARTED"
  | "BASIC_ATTACK"
  | "SPECIAL_ATTACK"
  | "AI_TURN"
  | "PROGRESSION_SYNC"
  | "DAILY_CHALLENGE_CLAIMED"
  | "SEASON_REWARD_CLAIMED"
  | "NOTIFICATION_READ";

async function authorizationHeader() {
  const token = await getSupabaseAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : null;
}

export async function loadCloudGameState(): Promise<PlayerState | null> {
  const headers = await authorizationHeader();
  if (!headers) return null;
  const response = await fetch("/api/game-state", { headers, cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Cloud game save is temporarily unavailable.");
  const body = await response.json() as { state?: PlayerState };
  return body.state ?? null;
}

type Activity = { type: GameActivityType; payload?: Record<string, unknown> };

export async function persistCloudGameState(state: PlayerState, type: GameActivityType, payload?: Record<string, unknown>, precedingActivities: Activity[] = []) {
  const headers = await authorizationHeader();
  if (!headers) throw new Error("Sign in before saving game progress.");
  const response = await fetch("/api/game-state", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ state, activity: { type, payload }, precedingActivities }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? "Cloud game save is temporarily unavailable.");
  }
}

type PendingSave = { state: PlayerState; activities: Activity[]; resolve: () => void; reject: (cause: unknown) => void; promise: Promise<void> };
const pendingSaves: PendingSave[] = [];
let saving = false;

async function drainSaves() {
  if (saving) return;
  saving = true;
  try {
    while (pendingSaves.length) {
      const save = pendingSaves.shift()!;
      const activity = save.activities.at(-1)!;
      try {
        await persistCloudGameState(save.state, activity.type, activity.payload, save.activities.slice(0, -1));
        save.resolve();
      } catch (cause) { save.reject(cause); }
    }
  } finally { saving = false; }
}

export function queueCloudGameState(state: PlayerState, type: GameActivityType, payload?: Record<string, unknown>) {
  const snapshot = structuredClone(state);
  const pending = pendingSaves.at(-1);
  // Purchases need their exact balance/opening snapshot. A progression flush is a
  // barrier: later gameplay must not replace the snapshot a claim is waiting for.
  if (pending && pending.state.account?.email === snapshot.account?.email
      && snapshot.saveRevision >= pending.state.saveRevision
      && type !== "PACK_PURCHASED"
      && !pending.activities.some(item => item.type === "PACK_PURCHASED" || item.type === "PROGRESSION_SYNC")) {
    pending.state = snapshot;
    pending.activities.push({ type, payload });
    return pending.promise;
  }
  let resolve!: () => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
  pendingSaves.push({ state: snapshot, activities: [{ type, payload }], resolve, reject, promise });
  void drainSaves();
  return promise;
}
