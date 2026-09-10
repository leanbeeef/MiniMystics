import { NextResponse } from "next/server";
import { Prisma, Rarity } from "@prisma/client";
import { grantStandardPack, type PlayerState } from "@/lib/client-state";
import { challengeForDate, claimDailyChallenge, claimSeasonTier, emptyProgression, seasonActive, seasonProgressFor, utcDateKey } from "@/lib/progression/state";
import { getRuntimeProgressionConfig } from "@/lib/server/progression-config";
import { getPrisma } from "@/lib/server/prisma";
import { requireSupabaseUser } from "@/lib/server/supabase-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ClaimBody = { kind?: "dailyChallenge" | "seasonTier"; tier?: number };
const asJson = (value: unknown) => value as Prisma.InputJsonValue;
const resultRarity = (value: string) => value === "Unassigned" ? null : value.toUpperCase() as Rarity;

export async function POST(request: Request) {
  try {
    const identity = await requireSupabaseUser(request);
    const body = await request.json().catch(() => null) as ClaimBody | null;
    if (!body || !["dailyChallenge", "seasonTier"].includes(body.kind ?? "")) {
      return NextResponse.json({ error: "Invalid progression reward." }, { status: 400 });
    }
    if (body.kind === "seasonTier" && (!Number.isSafeInteger(body.tier) || body.tier! < 1 || body.tier! > 50)) {
      return NextResponse.json({ error: "Invalid Season tier." }, { status: 400 });
    }

    const prisma = getPrisma();
    const runClaim = () => prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${identity.uid}, 0))`;
      const user = await tx.user.findFirst({
        where: { OR: [{ supabaseAuthId: identity.uid }, { email: identity.email }] },
        include: { profile: true },
      });
      if (!user?.profile) throw new Error("PROFILE_NOT_READY");
      const save = await tx.playerGameState.findUnique({ where: { profileId: user.profile.id } });
      if (!save) throw new Error("PROFILE_NOT_READY");

      const next = structuredClone(save.state) as unknown as PlayerState;
      next.progression ??= emptyProgression();
      next.progression.configuration = await getRuntimeProgressionConfig(tx);
      const now = new Date();
      let newOpeningId: string | null = null;
      let alreadyClaimed = false;
      const previousOwnedIds = new Set(next.ownedCards.map((owned) => owned.id));

      if (body.kind === "dailyChallenge") {
        const challenge = challengeForDate(now, next.progression.configuration.challenges);
        const challengeDate = utcDateKey(now);
        const assignedDate = new Date(`${challengeDate}T00:00:00.000Z`);
        const progress = next.progression.dailyChallenges[challengeDate];
        const definition = await tx.dailyChallengeDefinition.findUnique({ where: { id: challenge.id }, select: { id: true } });
        if (!definition) throw new Error("PROGRESSION_NOT_READY");
        const recorded = await tx.dailyChallengeAssignment.findUnique({
          where: { profileId_definitionId_assignedDate: { profileId: user.profile.id, definitionId: challenge.id, assignedDate } },
        });
        if (recorded?.rewardClaimed || progress?.rewardClaimed) {
          alreadyClaimed = true;
          const savedProgress = recorded?.progressData && typeof recorded.progressData === "object" && !Array.isArray(recorded.progressData)
            ? recorded.progressData as Record<string, unknown>
            : {};
          const reconciled = progress ?? {
            challengeId: challenge.id,
            challengeDate,
            values: savedProgress.values && typeof savedProgress.values === "object" ? savedProgress.values as Record<string, number> : Object.fromEntries(challenge.requirements.map((requirement) => [requirement.metric, requirement.target])),
            sets: savedProgress.sets && typeof savedProgress.sets === "object" ? savedProgress.sets as Record<string, string[]> : {},
            battleValues: savedProgress.battleValues && typeof savedProgress.battleValues === "object" ? savedProgress.battleValues as Record<string, Record<string, number>> : {},
            completed: true,
            rewardClaimed: true,
            completedAt: recorded?.completedAt?.toISOString() ?? now.toISOString(),
          };
          reconciled.completed = true;
          reconciled.rewardClaimed = true;
          next.progression.dailyChallenges[challengeDate] = reconciled;
          if (recorded && !recorded.rewardClaimed) await tx.dailyChallengeAssignment.update({ where: { id: recorded.id }, data: { completed: true, rewardClaimed: true, claimedAt: now } });
        } else {
          if (!progress || progress.challengeId !== challenge.id || !progress.completed || !recorded?.completed) throw new Error("CHALLENGE_INCOMPLETE");
          claimDailyChallenge(next, now);
          await tx.dailyChallengeAssignment.update({ where: { id: recorded.id }, data: { completed: true, rewardClaimed: true, claimedAt: now } });
        }
      } else {
        const tier = body.tier!;
        const config = next.progression.configuration.season;
        if (!seasonActive(now, config)) throw new Error("SEASON_INACTIVE");
        const season = await tx.season.findUnique({ where: { id: config.id }, select: { id: true } });
        if (!season) throw new Error("PROGRESSION_NOT_READY");
        const recorded = await tx.seasonPassRewardClaim.findUnique({
          where: { profileId_seasonId_tier_track: { profileId: user.profile.id, seasonId: config.id, tier, track: "FREE" } },
        });
        const progress = seasonProgressFor(next, now);
        if (recorded || progress.claimedTiers.includes(tier)) {
          alreadyClaimed = true;
          if (!progress.claimedTiers.includes(tier)) progress.claimedTiers.push(tier);
          if (!recorded) await tx.seasonPassRewardClaim.create({ data: { profileId: user.profile.id, seasonId: config.id, tier, track: "FREE", claimedAt: now } });
        } else {
          const reward = config.rewards[tier - 1];
          if ((reward?.type === "mystic" || reward?.type === "illustrationRare") && (!reward.definitionId || !(await tx.cardDefinition.findUnique({ where: { id: reward.definitionId }, select: { id: true } })))) {
            throw new Error("CARD_REWARD_NOT_READY");
          }
          const beforeOpeningId = next.activeOpeningId;
          claimSeasonTier(next, tier, () => grantStandardPack(next, "season", "Season Pass Standard Pack"), now, reward);
          if (next.activeOpeningId !== beforeOpeningId) newOpeningId = next.activeOpeningId;
          await tx.seasonPassRewardClaim.create({ data: { profileId: user.profile.id, seasonId: config.id, tier, track: "FREE", claimedAt: now } });
        }
      }

      next.saveRevision = Math.max(0, next.saveRevision ?? 0) + 1;
      await tx.playerProfile.update({
        where: { id: user.profile.id },
        data: { coins: next.coins, xp: next.xp, level: next.level },
      });
      await tx.playerGameState.update({
        where: { profileId: user.profile.id },
        data: { state: asJson(next), version: { increment: 1 } },
      });

      await tx.inventoryItem.deleteMany({ where: { profileId: user.profile.id } });
      const inventory = new Map<string, { type: string; rarity: Rarity; matches: number[] }>();
      for (const item of next.inventory) {
        const key = `${item.type}:${item.rarity}`;
        const stored: { type: string; rarity: Rarity; matches: number[] } = inventory.get(key) ?? {
          type: item.type,
          rarity: item.rarity.toUpperCase() as Rarity,
          matches: [],
        };
        stored.matches.push(item.matches);
        inventory.set(key, stored);
      }
      for (const item of inventory.values()) await tx.inventoryItem.create({
        data: { profileId: user.profile.id, itemType: item.type, rarity: item.rarity, quantity: item.matches.length, metadata: { matches: item.matches } },
      });

      for (const owned of next.ownedCards.filter((item) => !previousOwnedIds.has(item.id))) await tx.ownedCard.create({
        data: {
          id: owned.id,
          profileId: user.profile.id,
          definitionId: owned.definitionId,
          acquiredAt: new Date(owned.acquiredAt),
          acquisition: "SEASON_PASS",
          level: owned.level,
          variant: owned.variant ?? "standard",
          artworkVariant: owned.artworkVariant ?? "default",
        },
      });

      const progress = seasonProgressFor(next, now);
      if (await tx.season.findUnique({ where: { id: progress.seasonId }, select: { id: true } })) {
        await tx.playerSeasonProgress.upsert({
          where: { profileId_seasonId: { profileId: user.profile.id, seasonId: progress.seasonId } },
          create: { profileId: user.profile.id, seasonId: progress.seasonId, seasonXp: progress.seasonXp, currentTier: progress.currentTier, claimedFree: progress.claimedTiers, claimedPremium: [] },
          update: { seasonXp: progress.seasonXp, currentTier: progress.currentTier, claimedFree: progress.claimedTiers },
        });
      }

      if (newOpeningId) {
        const opening = next.openings.find((item) => item.id === newOpeningId)!;
        await tx.packOpening.create({ data: { id: opening.id, profileId: user.profile.id, packId: "standard", idempotencyKey: `season-pack:${user.profile.id}:${progress.seasonId}:${body.tier}`, currency: null } });
        await tx.packOpeningResult.createMany({
          data: opening.cards.map((card, position) => ({ openingId: opening.id, position, resultType: card.kind, definitionId: card.definitionId, rarity: resultRarity(card.rarity), quantity: card.amount, metadata: { revealed: false } })),
        });
        await tx.pityCounter.upsert({
          where: { profileId_packId: { profileId: user.profile.id, packId: "standard" } },
          create: { profileId: user.profile.id, packId: "standard", counter: next.pity },
          update: { counter: next.pity },
        });
      }
      return { state: next, alreadyClaimed };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 30_000 });
    let result;
    for (let attempt = 0; ; attempt += 1) {
      try {
        result = await runClaim();
        break;
      } catch (cause) {
        if (!(cause instanceof Prisma.PrismaClientKnownRequestError) || cause.code !== "P2034" || attempt >= 2) throw cause;
      }
    }
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "PROFILE_NOT_READY" || message === "PROGRESSION_NOT_READY") return NextResponse.json({ error: "Progression data is still being prepared. Try again in a moment." }, { status: 409 });
    if (message === "CHALLENGE_INCOMPLETE") return NextResponse.json({ error: "The Daily Challenge is not complete yet." }, { status: 409 });
    if (message === "REWARD_ALREADY_CLAIMED") return NextResponse.json({ error: "That reward has already been claimed." }, { status: 409 });
    if (message === "SEASON_INACTIVE") return NextResponse.json({ error: "This Season is no longer active." }, { status: 409 });
    if (message === "CARD_REWARD_NOT_READY") return NextResponse.json({ error: "This Season card reward has not been configured correctly." }, { status: 409 });
    if (/locked|coming before Season launch/i.test(message)) return NextResponse.json({ error: message }, { status: 409 });
    console.error("Progression reward claim failed", cause);
    return NextResponse.json({ error: "Could not claim the progression reward." }, { status: 500 });
  }
}
