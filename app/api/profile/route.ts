import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { PROFILE_AVATARS } from "@/lib/art";
import {
  ALLEGIANCES,
  REGIONS,
  normalizeHandlerName,
  validateHandlerName,
  type PlayerProfile,
  type ProfileInput,
} from "@/lib/profile-model";
import { requireSupabaseUser, type VerifiedSupabaseUser } from "@/lib/server/supabase-auth";
import { getPrisma } from "@/lib/server/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProfileRecord = Prisma.UserGetPayload<{ include: { profile: true; handlerName: true } }>;

function toProfile(user: ProfileRecord): PlayerProfile | null {
  if (!user.profile || !user.handlerName) return null;
  return {
    uid: user.supabaseAuthId ?? user.firebaseUid ?? user.id,
    handlerName: user.handlerName.displayName,
    handleNormalized: user.handlerName.normalizedName,
    avatarPath: user.profile.avatarPath ?? PROFILE_AVATARS[0].path,
    tagline: user.profile.tagline,
    region: user.profile.region,
    allegiance: user.profile.allegiance,
    favoriteMysticId: user.profile.favoriteMysticId,
    rankedTier: "Wild III",
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

function validationError(input: unknown): { code: string; error: string } | null {
  if (!input || typeof input !== "object") return { code: "profile/invalid-input", error: "Profile details are required." };
  const value = input as Partial<ProfileInput>;
  if (typeof value.handlerName !== "string") return { code: "profile/invalid-handler", error: "Choose a Handler name." };
  const nameError = validateHandlerName(value.handlerName);
  if (nameError) return { code: "profile/invalid-handler", error: nameError };
  if (typeof value.avatarPath !== "string" || !PROFILE_AVATARS.some((avatar) => avatar.path === value.avatarPath)) return { code: "profile/invalid-avatar", error: "Choose an available avatar." };
  if (typeof value.region !== "string" || !REGIONS.includes(value.region as typeof REGIONS[number])) return { code: "profile/invalid-region", error: "Choose a region." };
  if (typeof value.allegiance !== "string" || !ALLEGIANCES.includes(value.allegiance as typeof ALLEGIANCES[number])) return { code: "profile/invalid-allegiance", error: "Choose an allegiance." };
  if (typeof value.tagline !== "string" || value.tagline.trim().length > 80) return { code: "profile/invalid-tagline", error: "Taglines can contain up to 80 characters." };
  if (value.favoriteMysticId !== null && value.favoriteMysticId !== undefined && typeof value.favoriteMysticId !== "string") return { code: "profile/invalid-favorite", error: "Choose an available favorite Mystic." };
  return null;
}

async function prohibitedHandler(normalizedName: string) {
  const entries = await getPrisma().prohibitedHandlerName.findMany({ where: { active: true }, select: { normalizedName: true, matchType: true } });
  return entries.some((entry) => entry.matchType.toUpperCase() === "CONTAINS"
    ? normalizedName.includes(entry.normalizedName)
    : normalizedName === entry.normalizedName);
}

async function findIdentityUser(identity: VerifiedSupabaseUser) {
  const prisma = getPrisma();
  const user = await prisma.user.findFirst({
    where: { OR: [{ supabaseAuthId: identity.uid }, { email: identity.email }] },
    include: { profile: true, handlerName: true },
  });
  if (user && user.supabaseAuthId !== identity.uid) {
    return prisma.user.update({ where: { id: user.id }, data: { supabaseAuthId: identity.uid, email: identity.email }, include: { profile: true, handlerName: true } });
  }
  return user;
}

function safeUsername(value: string, uid: string) {
  const clean = value.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 20);
  return clean.length >= 3 ? clean : `Handler${uid.slice(0, 8)}`;
}

function apiError(cause: unknown) {
  const unauthorized = cause instanceof Error && cause.message === "UNAUTHORIZED";
  if (!unauthorized) console.error("Profile persistence failed", cause);
  return NextResponse.json(
    { error: unauthorized ? "Unauthorized" : "Could not update the Handler profile." },
    { status: unauthorized ? 401 : 500 },
  );
}

export async function GET(request: Request) {
  try {
    const identity = await requireSupabaseUser(request);
    const requestedHandler = new URL(request.url).searchParams.get("handler");
    if (requestedHandler !== null) {
      const validation = validateHandlerName(requestedHandler);
      if (validation) return NextResponse.json({ available: false, error: validation });
      const normalizedName = normalizeHandlerName(requestedHandler);
      if (await prohibitedHandler(normalizedName)) return NextResponse.json({ available: false, error: "That Handler name is unavailable." });
      const owner = await getPrisma().handlerName.findUnique({
        where: { normalizedName },
        select: { user: { select: { supabaseAuthId: true, email: true } } },
      });
      const available = !owner || owner.user.supabaseAuthId === identity.uid || owner.user.email === identity.email;
      return NextResponse.json({ available, error: available ? null : "That Handler name is already claimed." });
    }

    const user = await findIdentityUser(identity);
    const profile = user ? toProfile(user) : null;
    if (!profile) return NextResponse.json({ error: "No Handler profile yet." }, { status: 404 });
    return NextResponse.json(profile, { headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) {
    return apiError(cause);
  }
}

export async function PUT(request: Request) {
  try {
    const identity = await requireSupabaseUser(request);
    const raw = await request.text();
    if (raw.length > 20_000) return NextResponse.json({ error: "Profile data is too large." }, { status: 413 });
    const input = JSON.parse(raw) as ProfileInput;
    const invalid = validationError(input);
    if (invalid) return NextResponse.json(invalid, { status: 400 });

    const displayName = input.handlerName.trim();
    const normalizedName = normalizeHandlerName(displayName);
    if (await prohibitedHandler(normalizedName)) return NextResponse.json({ code: "profile/invalid-handler", error: "That Handler name is unavailable." }, { status: 400 });

    const prisma = getPrisma();
    const result = await prisma.$transaction(async (tx) => {
      let user = await tx.user.findFirst({ where: { OR: [{ supabaseAuthId: identity.uid }, { email: identity.email }] } });
      if (!user) {
        let username = safeUsername(displayName, identity.uid);
        if (await tx.user.findUnique({ where: { username } })) username = `Handler${identity.uid.slice(0, 8)}`;
        user = await tx.user.create({ data: { supabaseAuthId: identity.uid, email: identity.email, username } });
      } else {
        user = await tx.user.update({ where: { id: user.id }, data: { supabaseAuthId: identity.uid, email: identity.email } });
      }
      for (const account of identity.accounts) {
        await tx.authAccount.upsert({
          where: { userId_provider: { userId: user.id, provider: account.provider } },
          create: { userId: user.id, provider: account.provider, providerAccountId: account.providerAccountId, emailVerified: identity.emailVerified },
          update: { providerAccountId: account.providerAccountId, emailVerified: identity.emailVerified },
        });
      }

      const owner = await tx.handlerName.findUnique({ where: { normalizedName } });
      if (owner && owner.userId !== user.id) throw Object.assign(new Error("HANDLER_TAKEN"), { code: "profile/handler-taken" });

      await tx.playerProfile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          avatarPath: input.avatarPath,
          tagline: input.tagline.trim(),
          region: input.region,
          allegiance: input.allegiance,
          favoriteMysticId: input.favoriteMysticId || null,
        },
        update: {
          avatarPath: input.avatarPath,
          tagline: input.tagline.trim(),
          region: input.region,
          allegiance: input.allegiance,
          favoriteMysticId: input.favoriteMysticId || null,
        },
      });
      await tx.handlerName.upsert({
        where: { userId: user.id },
        create: { userId: user.id, displayName, normalizedName },
        update: { displayName, normalizedName, forcedRename: false },
      });

      const usernameOwner = await tx.user.findUnique({ where: { username: displayName } });
      if (!usernameOwner || usernameOwner.id === user.id) {
        await tx.user.update({ where: { id: user.id }, data: { username: displayName } });
      }
      return tx.user.findUniqueOrThrow({ where: { id: user.id }, include: { profile: true, handlerName: true } });
    });

    return NextResponse.json(toProfile(result));
  } catch (cause) {
    if (cause instanceof Error && (cause.message === "HANDLER_TAKEN" || (cause as { code?: string }).code === "P2002")) {
      return NextResponse.json({ code: "profile/handler-taken", error: "That Handler name is already claimed." }, { status: 409 });
    }
    return apiError(cause);
  }
}
