import type { User } from "firebase/auth";
import { doc, getDoc, runTransaction } from "firebase/firestore";
import { getFirebaseFirestore } from "./firebase";
import { PROFILE_AVATARS } from "./art";

export const REGIONS = ["North America", "South America", "Europe", "Asia Pacific", "Middle East & Africa"] as const;
export const ALLEGIANCES = ["Mortalborn", "Ascendant", "Unbound", "Voidbound"] as const;

export type PlayerProfile = {
  uid: string;
  handlerName: string;
  handleNormalized: string;
  avatarPath: string;
  tagline: string;
  region: string;
  allegiance: string;
  favoriteMysticId: string | null;
  rankedTier: string;
  createdAt: string;
  updatedAt: string;
};

export type ProfileInput = Pick<PlayerProfile, "handlerName" | "avatarPath" | "tagline" | "region" | "allegiance" | "favoriteMysticId">;

const RESERVED = new Set(["admin", "administrator", "moderator", "mod", "minimystics", "mini-mystics", "support", "system", "staff"]);
const BLOCKED_PARTS = ["fuck", "shit", "bitch", "cunt", "nigger", "faggot"];

export function normalizeHandlerName(value: string) {
  return value.trim().toLowerCase();
}

export function validateHandlerName(value: string): string | null {
  const name = value.trim();
  const normalized = normalizeHandlerName(name);
  if (name.length < 3 || name.length > 20) return "Handler names must be 3 to 20 characters.";
  if (!/^[A-Za-z0-9_-]+$/.test(name)) return "Use only letters, numbers, underscores, or hyphens.";
  if (RESERVED.has(normalized)) return "That Handler name is reserved.";
  if (BLOCKED_PARTS.some((part) => normalized.includes(part))) return "Choose a different Handler name.";
  return null;
}

function profileError(code: string, message: string) {
  return Object.assign(new Error(message), { code });
}

export async function getPlayerProfile(uid: string): Promise<PlayerProfile | null> {
  const snapshot = await getDoc(doc(getFirebaseFirestore(), "profiles", uid));
  return snapshot.exists() ? snapshot.data() as PlayerProfile : null;
}

export async function isHandlerAvailable(value: string, currentUid?: string) {
  const error = validateHandlerName(value);
  if (error) return { available: false, error };
  const snapshot = await getDoc(doc(getFirebaseFirestore(), "handles", normalizeHandlerName(value)));
  const owner = snapshot.exists() ? String(snapshot.data().uid ?? "") : "";
  return { available: !snapshot.exists() || owner === currentUid, error: snapshot.exists() && owner !== currentUid ? "That Handler name is already claimed." : null };
}

export async function savePlayerProfile(uid: string, input: ProfileInput): Promise<PlayerProfile> {
  const nameError = validateHandlerName(input.handlerName);
  if (nameError) throw profileError("profile/invalid-handler", nameError);
  if (!PROFILE_AVATARS.some((avatar) => avatar.path === input.avatarPath)) throw profileError("profile/invalid-avatar", "Choose an available avatar.");
  if (!REGIONS.includes(input.region as typeof REGIONS[number])) throw profileError("profile/invalid-region", "Choose a region.");
  if (!ALLEGIANCES.includes(input.allegiance as typeof ALLEGIANCES[number])) throw profileError("profile/invalid-allegiance", "Choose an allegiance.");
  if (input.tagline.trim().length > 80) throw profileError("profile/invalid-tagline", "Taglines can contain up to 80 characters.");

  const db = getFirebaseFirestore();
  const profileRef = doc(db, "profiles", uid);
  const normalized = normalizeHandlerName(input.handlerName);
  const handleRef = doc(db, "handles", normalized);
  const now = new Date().toISOString();

  return runTransaction(db, async (transaction) => {
    const existingProfile = await transaction.get(profileRef);
    const nextHandle = await transaction.get(handleRef);
    const oldProfile = existingProfile.exists() ? existingProfile.data() as PlayerProfile : null;
    const oldHandleRef = oldProfile && oldProfile.handleNormalized !== normalized ? doc(db, "handles", oldProfile.handleNormalized) : null;
    const oldHandle = oldHandleRef ? await transaction.get(oldHandleRef) : null;

    if (nextHandle.exists() && nextHandle.data().uid !== uid) throw profileError("profile/handler-taken", "That Handler name is already claimed.");

    const profile: PlayerProfile = {
      uid,
      handlerName: input.handlerName.trim(),
      handleNormalized: normalized,
      avatarPath: input.avatarPath,
      tagline: input.tagline.trim(),
      region: input.region,
      allegiance: input.allegiance,
      favoriteMysticId: input.favoriteMysticId || null,
      rankedTier: oldProfile?.rankedTier ?? "Wild III",
      createdAt: oldProfile?.createdAt ?? now,
      updatedAt: now,
    };

    transaction.set(handleRef, { uid, handlerName: profile.handlerName, updatedAt: now });
    transaction.set(profileRef, profile);
    if (oldHandleRef && oldHandle?.exists() && oldHandle.data().uid === uid) transaction.delete(oldHandleRef);
    return profile;
  });
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
