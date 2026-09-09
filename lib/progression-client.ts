import type { PlayerState } from "./client-state";
import { getSupabaseAccessToken } from "./supabase";

export async function claimDailyPackFromServer(): Promise<PlayerState> {
  const token = await getSupabaseAccessToken();
  if (!token) throw new Error("Sign in before claiming your Daily Pack.");
  const response = await fetch("/api/progression/daily-pack", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  const body = await response.json().catch(() => null) as { state?: PlayerState; error?: string } | null;
  if (!response.ok || !body?.state) throw new Error(body?.error ?? "Could not claim the Daily Pack.");
  return body.state;
}

async function claimProgressionReward(body: { kind: "dailyChallenge" | "seasonTier"; tier?: number }): Promise<PlayerState> {
  const token = await getSupabaseAccessToken();
  if (!token) throw new Error("Sign in before claiming progression rewards.");
  const response = await fetch("/api/progression/claim", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => null) as { state?: PlayerState; error?: string } | null;
  if (!response.ok || !result?.state) throw new Error(result?.error ?? "Could not claim the progression reward.");
  return result.state;
}

export const claimDailyChallengeFromServer = () => claimProgressionReward({ kind: "dailyChallenge" });
export const claimSeasonTierFromServer = (tier: number) => claimProgressionReward({ kind: "seasonTier", tier });
