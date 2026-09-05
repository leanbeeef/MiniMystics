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
