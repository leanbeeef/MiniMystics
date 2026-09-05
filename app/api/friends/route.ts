import { NextResponse } from "next/server";
import { FriendshipStatus, Prisma } from "@prisma/client";
import { PROFILE_AVATARS } from "@/lib/art";
import type { FriendEntry } from "@/lib/social";
import type { PlayerProfile } from "@/lib/profile-model";
import { normalizeHandlerName } from "@/lib/profile-model";
import { requireFirebaseUser, type VerifiedFirebaseUser } from "@/lib/server/firebase-auth";
import { getPrisma } from "@/lib/server/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RelatedProfile = Prisma.PlayerProfileGetPayload<{ include: { user: { include: { handlerName: true } } } }>;
type Relationship = Prisma.FriendshipGetPayload<{
  include: {
    requester: { include: { user: { include: { handlerName: true } } } };
    addressee: { include: { user: { include: { handlerName: true } } } };
  };
}>;

function profileDto(profile: RelatedProfile): PlayerProfile | null {
  const handler = profile.user.handlerName;
  if (!handler) return null;
  return {
    uid: profile.user.firebaseUid ?? profile.user.id,
    handlerName: handler.displayName,
    handleNormalized: handler.normalizedName,
    avatarPath: profile.avatarPath ?? PROFILE_AVATARS[0].path,
    tagline: profile.tagline,
    region: profile.region,
    allegiance: profile.allegiance,
    favoriteMysticId: profile.favoriteMysticId,
    rankedTier: "Wild III",
    createdAt: profile.user.createdAt.toISOString(),
    updatedAt: profile.user.updatedAt.toISOString(),
  };
}

async function currentProfile(identity: VerifiedFirebaseUser) {
  return getPrisma().playerProfile.findFirst({
    where: { user: { OR: [{ firebaseUid: identity.uid }, { email: identity.email }] } },
    include: { user: { include: { handlerName: true } } },
  });
}

function relationshipDto(relationship: Relationship, mine: RelatedProfile): FriendEntry {
  const other = relationship.requesterId === mine.id ? relationship.addressee : relationship.requester;
  const requesterUid = relationship.requester.user.firebaseUid ?? relationship.requester.user.id;
  const mineUid = mine.user.firebaseUid ?? mine.user.id;
  const direction = relationship.status === FriendshipStatus.FRIENDS
    ? "friends"
    : requesterUid === mineUid ? "outgoing" : "incoming";
  return {
    id: relationship.id,
    members: [
      relationship.requester.user.firebaseUid ?? relationship.requester.user.id,
      relationship.addressee.user.firebaseUid ?? relationship.addressee.user.id,
    ],
    requestedBy: requesterUid,
    status: relationship.status === FriendshipStatus.FRIENDS ? "friends" : "pending",
    createdAt: relationship.createdAt.toISOString(),
    updatedAt: relationship.updatedAt.toISOString(),
    profile: profileDto(other),
    direction,
  };
}

async function bodyId(request: Request, key: "friendshipId" | "recipientUid") {
  const raw = await request.text();
  if (raw.length > 5_000) return "";
  const body = JSON.parse(raw) as Record<string, unknown>;
  return typeof body[key] === "string" ? body[key].trim() : "";
}

function apiError(cause: unknown) {
  const unauthorized = cause instanceof Error && cause.message === "UNAUTHORIZED";
  if (!unauthorized) console.error("Friends persistence failed", cause);
  return NextResponse.json({ error: unauthorized ? "Unauthorized" : "Could not update friends." }, { status: unauthorized ? 401 : 500 });
}

export async function GET(request: Request) {
  try {
    const identity = await requireFirebaseUser(request);
    const handler = new URL(request.url).searchParams.get("handler");
    if (handler !== null) {
      const found = await getPrisma().playerProfile.findFirst({
        where: { user: { handlerName: { normalizedName: normalizeHandlerName(handler) } } },
        include: { user: { include: { handlerName: true } } },
      });
      const result = found ? profileDto(found) : null;
      if (!result) return NextResponse.json({ error: "Handler not found." }, { status: 404 });
      return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
    }

    const mine = await currentProfile(identity);
    if (!mine) return NextResponse.json([], { headers: { "Cache-Control": "private, no-store" } });
    const relationships = await getPrisma().friendship.findMany({
      where: {
        AND: [
          { OR: [{ requesterId: mine.id }, { addresseeId: mine.id }] },
          { status: { in: [FriendshipStatus.PENDING, FriendshipStatus.FRIENDS] } },
        ],
      },
      include: {
        requester: { include: { user: { include: { handlerName: true } } } },
        addressee: { include: { user: { include: { handlerName: true } } } },
      },
      orderBy: { updatedAt: "desc" },
    });
    const entries = relationships
      .map((relationship) => relationshipDto(relationship, mine))
      .sort((a, b) => (a.profile?.handlerName ?? "").localeCompare(b.profile?.handlerName ?? ""));
    return NextResponse.json(entries, { headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) {
    return apiError(cause);
  }
}

export async function POST(request: Request) {
  try {
    const identity = await requireFirebaseUser(request);
    const recipientUid = await bodyId(request, "recipientUid");
    if (!recipientUid) return NextResponse.json({ error: "Choose a Handler first." }, { status: 400 });
    const mine = await currentProfile(identity);
    if (!mine) return NextResponse.json({ error: "Finish your Handler profile before adding friends." }, { status: 409 });
    const recipient = await getPrisma().playerProfile.findFirst({
      where: { user: { OR: [{ firebaseUid: recipientUid }, { id: recipientUid }] } },
      include: { user: { include: { handlerName: true } } },
    });
    if (!recipient) return NextResponse.json({ error: "That Handler no longer exists." }, { status: 404 });
    if (recipient.id === mine.id) return NextResponse.json({ error: "You cannot send a friend request to yourself." }, { status: 400 });

    const prisma = getPrisma();
    const existing = await prisma.friendship.findFirst({
      where: { OR: [
        { requesterId: mine.id, addresseeId: recipient.id },
        { requesterId: recipient.id, addresseeId: mine.id },
      ] },
    });
    if (existing && existing.status !== FriendshipStatus.REMOVED) {
      return NextResponse.json({ error: existing.status === FriendshipStatus.FRIENDS ? "You are already friends." : "A friend request is already pending." }, { status: 409 });
    }
    if (existing) await prisma.friendship.delete({ where: { id: existing.id } });
    await prisma.friendship.create({ data: { requesterId: mine.id, addresseeId: recipient.id, status: FriendshipStatus.PENDING } });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (cause) {
    return apiError(cause);
  }
}

export async function PATCH(request: Request) {
  try {
    const identity = await requireFirebaseUser(request);
    const friendshipId = await bodyId(request, "friendshipId");
    const mine = await currentProfile(identity);
    if (!friendshipId || !mine) return NextResponse.json({ error: "Friend request not found." }, { status: 404 });
    const result = await getPrisma().friendship.updateMany({
      where: { id: friendshipId, addresseeId: mine.id, status: FriendshipStatus.PENDING },
      data: { status: FriendshipStatus.FRIENDS },
    });
    if (!result.count) return NextResponse.json({ error: "Only the recipient can accept this request." }, { status: 403 });
    return NextResponse.json({ ok: true });
  } catch (cause) {
    return apiError(cause);
  }
}

export async function DELETE(request: Request) {
  try {
    const identity = await requireFirebaseUser(request);
    const friendshipId = await bodyId(request, "friendshipId");
    const mine = await currentProfile(identity);
    if (!friendshipId || !mine) return NextResponse.json({ error: "Friendship not found." }, { status: 404 });
    const result = await getPrisma().friendship.updateMany({
      where: { id: friendshipId, OR: [{ requesterId: mine.id }, { addresseeId: mine.id }] },
      data: { status: FriendshipStatus.REMOVED },
    });
    if (!result.count) return NextResponse.json({ error: "Friendship not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (cause) {
    return apiError(cause);
  }
}
