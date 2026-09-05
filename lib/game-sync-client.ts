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
  | "BINDER_CREATED"
  | "BINDER_RENAMED"
  | "BINDER_CARD_TOGGLED"
  | "CARD_SOLD"
  | "BATTLE_STARTED"
  | "BASIC_ATTACK"
  | "SPECIAL_ATTACK"
  | "HANDLER_USED"
  | "AI_TURN";

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

export async function persistCloudGameState(state: PlayerState, type: GameActivityType, payload?: Record<string, unknown>) {
  const headers = await authorizationHeader();
  if (!headers) return;
  const response = await fetch("/api/game-state", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ state, activity: { type, payload } }),
  });
  if (!response.ok) throw new Error("Cloud game save is temporarily unavailable.");
}

let syncQueue = Promise.resolve();

export function queueCloudGameState(state: PlayerState, type: GameActivityType, payload?: Record<string, unknown>) {
  const snapshot = structuredClone(state);
  syncQueue = syncQueue
    .catch(() => undefined)
    .then(() => persistCloudGameState(snapshot, type, payload))
    .catch(() => undefined);
  return syncQueue;
}
