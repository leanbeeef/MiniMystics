import type { User } from "firebase/auth";
import { PROFILE_AVATARS } from "./art";
import { getFirebaseAuth } from "./firebase";
import {
  ALLEGIANCES,
  REGIONS,
  validateHandlerName,
  type PlayerProfile,
  type ProfileInput,
} from "./profile-model";

export { ALLEGIANCES, REGIONS, normalizeHandlerName, validateHandlerName } from "./profile-model";
export type { PlayerProfile, ProfileInput } from "./profile-model";

function profileError(code: string, message: string) {
  return Object.assign(new Error(message), { code });
}

async function authenticatedHeaders(json = false): Promise<Record<string, string>> {
  const currentUser = getFirebaseAuth().currentUser;
  if (!currentUser) throw profileError("auth/unauthenticated", "Sign in to manage your Handler profile.");
  return {
    Authorization: `Bearer ${await currentUser.getIdToken()}`,
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

async function responseError(response: Response, fallback: string) {
  const body = await response.json().catch(() => null) as { error?: string; code?: string } | null;
  return profileError(body?.code ?? `profile/http-${response.status}`, body?.error ?? fallback);
}

export async function getPlayerProfile(_uid: string): Promise<PlayerProfile | null> {
  const response = await fetch("/api/profile", { headers: await authenticatedHeaders(), cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw await responseError(response, "Could not load your Handler profile.");
  return response.json() as Promise<PlayerProfile>;
}

export async function isHandlerAvailable(value: string, _currentUid?: string) {
  const error = validateHandlerName(value);
  if (error) return { available: false, error };
  const response = await fetch(`/api/profile?handler=${encodeURIComponent(value)}`, {
    headers: await authenticatedHeaders(),
    cache: "no-store",
  });
  if (!response.ok) throw await responseError(response, "Could not check that Handler name.");
  return response.json() as Promise<{ available: boolean; error: string | null }>;
}

export async function savePlayerProfile(_uid: string, input: ProfileInput): Promise<PlayerProfile> {
  const nameError = validateHandlerName(input.handlerName);
  if (nameError) throw profileError("profile/invalid-handler", nameError);
  if (!PROFILE_AVATARS.some((avatar) => avatar.path === input.avatarPath)) throw profileError("profile/invalid-avatar", "Choose an available avatar.");
  if (!REGIONS.includes(input.region as typeof REGIONS[number])) throw profileError("profile/invalid-region", "Choose a region.");
  if (!ALLEGIANCES.includes(input.allegiance as typeof ALLEGIANCES[number])) throw profileError("profile/invalid-allegiance", "Choose an allegiance.");
  if (input.tagline.trim().length > 80) throw profileError("profile/invalid-tagline", "Taglines can contain up to 80 characters.");

  const response = await fetch("/api/profile", {
    method: "PUT",
    headers: await authenticatedHeaders(true),
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await responseError(response, "Could not save your Handler profile.");
  return response.json() as Promise<PlayerProfile>;
}

function safeBaseName(user: User, preferredName?: string) {
  const source = preferredName?.trim() || user.displayName?.trim() || user.email?.split("@")[0] || "Handler";
  const clean = source.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 14);
  return clean.length >= 3 && !validateHandlerName(clean) ? clean : "Handler";
}

export async function ensurePlayerProfile(user: User, preferredName?: string) {
  const existing = await getPlayerProfile(user.uid);
  if (existing) return existing;
  const base = safeBaseName(user, preferredName);
  const candidates = [base, `${base}${user.uid.slice(0, 4)}`, `Handler${user.uid.slice(0, 6)}`];
  for (const candidate of candidates) {
    const availability = await isHandlerAvailable(candidate, user.uid);
    if (!availability.available) continue;
    try {
      return await savePlayerProfile(user.uid, {
        handlerName: candidate,
        avatarPath: PROFILE_AVATARS[0].path,
        tagline: "",
        region: REGIONS[0],
        allegiance: ALLEGIANCES[0],
        favoriteMysticId: null,
      });
    } catch (cause) {
      if (!(cause instanceof Error) || !cause.message.includes("already claimed")) throw cause;
    }
  }
  throw profileError("profile/no-handler", "Choose a unique Handler name to finish your profile.");
}
