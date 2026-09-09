import { NextResponse } from "next/server";
import { Prisma, Rarity } from "@prisma/client";
import { grantStandardPack, type PlayerState } from "@/lib/client-state";
import { emptyProgression, isDailyPackAvailable, utcDateKey } from "@/lib/progression/state";
import { getPrisma } from "@/lib/server/prisma";
import { requireSupabaseUser } from "@/lib/server/supabase-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const asJson = (value: unknown) => value as Prisma.InputJsonValue;
const rarity = (value: string) => value === "Unassigned" ? null : value.toUpperCase() as Rarity;

export async function POST(request: Request) {
  try {
    const identity = await requireSupabaseUser(request);
    const prisma = getPrisma();
    const result = await prisma.$transaction(async tx => {
      const user = await tx.user.findFirst({ where: { OR: [{ supabaseAuthId: identity.uid }, { email: identity.email }] }, include: { profile: { include: { gameState: true } } } });
      const profile = user?.profile;
      if (!profile?.gameState) throw new Error("PROFILE_NOT_READY");
      // Serialize claims for this profile before checking the timestamp. Retries and double taps
      // cannot both pass eligibility, even when they arrive at different workers.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${profile.id}, 0))`;
      const fresh = await tx.playerProfile.findUniqueOrThrow({ where: { id: profile.id }, include: { gameState: true } });
      const now = new Date();
      if (!isDailyPackAvailable(fresh.lastDailyPackClaimAt?.toISOString() ?? null, now)) {
        const next = new Date(fresh.lastDailyPackClaimAt!.getTime() + 86_400_000);
        return { available: false as const, nextAvailableAt: next.toISOString() };
      }
      const state = structuredClone(fresh.gameState!.state) as unknown as PlayerState;
      state.progression ??= emptyProgression();
      grantStandardPack(state, "daily", "Daily Standard Pack");
      state.progression.lastDailyPackClaimAt = now.toISOString();
      state.progression.notifications.forEach(item => { if (item.kind === "dailyPack") item.read = true; });
      state.saveRevision = Math.max(0, state.saveRevision ?? 0) + 1;
      const opening = state.openings[0];
      const rewardDate = new Date(`${utcDateKey(now)}T00:00:00.000Z`);

      await tx.playerProfile.update({ where: { id: fresh.id }, data: { lastDailyPackClaimAt: now, level: state.level, xp: state.xp, coins: state.coins } });
      await tx.playerGameState.update({ where: { profileId: fresh.id }, data: { state: asJson(state), version: { increment: 1 } } });
      await tx.playerDailyReward.create({ data: { profileId: fresh.id, rewardDate, claimedAt: now, packOpeningId: opening.id } });
      await tx.packOpening.create({ data: { id: opening.id, profileId: fresh.id, packId: "standard", idempotencyKey: `daily-pack:${fresh.id}:${now.toISOString()}`, currency: null } });
      await tx.packOpeningResult.createMany({ data: opening.cards.map((card, position) => ({ openingId: opening.id, position, resultType: card.kind, definitionId: card.definitionId, rarity: rarity(card.rarity), quantity: card.amount, metadata: { revealed: false } })) });
      for (const owned of state.ownedCards) await tx.ownedCard.upsert({
        where: { id: owned.id },
        create: { id: owned.id, profileId: fresh.id, definitionId: owned.definitionId, acquiredAt: new Date(owned.acquiredAt), acquisition: "DAILY_PACK", level: owned.level, variant: owned.variant ?? "standard", artworkVariant: owned.artworkVariant ?? "default" },
        update: {},
      });
      await tx.inventoryItem.deleteMany({ where: { profileId: fresh.id } });
      const inventory = new Map<string, { type: string; rarity: Rarity; matches: number[] }>();
      for (const item of state.inventory) {
        const key = `${item.type}:${item.rarity}`;
        const stored: { type: string; rarity: Rarity; matches: number[] } = inventory.get(key) ?? {
          type: item.type,
          rarity: item.rarity.toUpperCase() as Rarity,
          matches: [],
        };
        stored.matches.push(item.matches); inventory.set(key, stored);
      }
      for (const item of inventory.values()) await tx.inventoryItem.create({ data: { profileId: fresh.id, itemType: item.type, rarity: item.rarity, quantity: item.matches.length, metadata: { matches: item.matches } } });
      await tx.pityCounter.upsert({ where: { profileId_packId: { profileId: fresh.id, packId: "standard" } }, create: { profileId: fresh.id, packId: "standard", counter: state.pity }, update: { counter: state.pity } });
      return { available: true as const, state };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 30_000 });
    if (!result.available) return NextResponse.json({ error: "Your next Daily Pack is not ready yet.", nextAvailableAt: result.nextAvailableAt }, { status: 409 });
    return NextResponse.json({ state: result.state }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "PROFILE_NOT_READY") return NextResponse.json({ error: "Your cloud profile is still being prepared. Try again in a moment." }, { status: 409 });
    console.error("Daily Pack claim failed", cause);
    return NextResponse.json({ error: "Could not claim the Daily Pack." }, { status: 500 });
  }
}
