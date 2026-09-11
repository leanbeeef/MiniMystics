import { NextResponse } from "next/server";
import { CardKind, CurrencyKind, MatchMode, MatchSide, MatchStatus, MatchTiming, Prisma, Rarity } from "@prisma/client";
import type { PlayerState } from "@/lib/client-state";
import { requireSupabaseUser } from "@/lib/server/supabase-auth";
import { getPrisma } from "@/lib/server/prisma";
import { emptyProgression } from "@/lib/progression/state";
import { getRuntimeProgressionConfig } from "@/lib/server/progression-config";
import { reconcileAdminBalance } from "@/lib/admin-balance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SyncBody = {
  state?: PlayerState;
  activity?: { type?: string; payload?: Record<string, unknown> };
  precedingActivities?: { type?: string; payload?: Record<string, unknown> }[];
};

type PersistedProgression = {
  lastDailyPackClaimAt: Date | null;
  seasonProgress: { seasonId: string; seasonXp: number; currentTier: number; claimedFree: Prisma.JsonValue }[];
  seasonRewardClaims: { seasonId: string; tier: number; track: string }[];
  challengeAssignments: { definitionId: string; assignedDate: Date; progress: number; progressData: Prisma.JsonValue | null; completed: boolean; rewardClaimed: boolean; completedAt: Date | null }[];
};

const asJson = (value: unknown) => value as Prisma.InputJsonValue;
const rarity = (value: string | undefined) => value && value !== "Unassigned" ? value.toUpperCase() as Rarity : null;
const date = (value: string | undefined) => {
  const parsed = value ? new Date(value) : new Date();
  return Number.isNaN(parsed.valueOf()) ? new Date() : parsed;
};
const saveRevision = (value: unknown) => {
  if (!value || typeof value !== "object") return 0;
  const revision = (value as { saveRevision?: unknown }).saveRevision;
  return typeof revision === "number" && Number.isSafeInteger(revision) && revision >= 0 ? revision : 0;
};

function validState(value: unknown): value is PlayerState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<PlayerState>;
  return Boolean(
    state.account
    && typeof state.account.email === "string"
    && typeof state.account.username === "string"
    && Number.isSafeInteger(state.level)
    && Number.isSafeInteger(state.coins)
    && Array.isArray(state.ownedCards)
    && Array.isArray(state.openings)
    && Array.isArray(state.loadouts)
    && Array.isArray(state.binders)
    && Array.isArray(state.campaignWins),
  );
}

function reconcileProgression(state: PlayerState, persisted: PersistedProgression) {
  state.progression ??= emptyProgression();
  if (persisted.lastDailyPackClaimAt) state.progression.lastDailyPackClaimAt = persisted.lastDailyPackClaimAt.toISOString();
  for (const saved of persisted.seasonProgress) {
    const progress = state.progression.seasons[saved.seasonId] ?? {
      seasonId: saved.seasonId,
      seasonXp: 0,
      currentTier: 1,
      claimedTiers: [],
      updatedAt: new Date().toISOString(),
    };
    const savedClaims = Array.isArray(saved.claimedFree) ? saved.claimedFree.filter((tier): tier is number => typeof tier === "number") : [];
    progress.seasonXp = Math.max(progress.seasonXp, saved.seasonXp);
    progress.currentTier = Math.max(progress.currentTier, saved.currentTier);
    progress.claimedTiers = [...new Set([...progress.claimedTiers, ...savedClaims])];
    state.progression.seasons[saved.seasonId] = progress;
  }
  for (const claim of persisted.seasonRewardClaims) {
    if (claim.track !== "FREE") continue;
    const progress = state.progression.seasons[claim.seasonId] ?? {
      seasonId: claim.seasonId,
      seasonXp: 0,
      currentTier: Math.max(1, claim.tier),
      claimedTiers: [],
      updatedAt: new Date().toISOString(),
    };
    if (!progress.claimedTiers.includes(claim.tier)) progress.claimedTiers.push(claim.tier);
    state.progression.seasons[claim.seasonId] = progress;
  }
  for (const assignment of persisted.challengeAssignments) {
    const key = assignment.assignedDate.toISOString().slice(0, 10);
    const stored = assignment.progressData && typeof assignment.progressData === "object" && !Array.isArray(assignment.progressData)
      ? assignment.progressData as Record<string, unknown>
      : {};
    const existing = state.progression.dailyChallenges[key];
    state.progression.dailyChallenges[key] = {
      challengeId: assignment.definitionId,
      challengeDate: key,
      values: existing?.values ?? (stored.values && typeof stored.values === "object" ? stored.values as Record<string, number> : { progress: assignment.progress }),
      sets: existing?.sets ?? (stored.sets && typeof stored.sets === "object" ? stored.sets as Record<string, string[]> : {}),
      battleValues: existing?.battleValues ?? (stored.battleValues && typeof stored.battleValues === "object" ? stored.battleValues as Record<string, Record<string, number>> : {}),
      completed: Boolean(existing?.completed || assignment.completed),
      rewardClaimed: Boolean(existing?.rewardClaimed || assignment.rewardClaimed),
      completedAt: existing?.completedAt ?? assignment.completedAt?.toISOString(),
    };
  }
}

function safeUsername(value: string, uid: string) {
  const clean = value.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 20);
  return clean.length >= 3 ? clean : `Handler${uid.slice(0, 8)}`;
}

async function findOrCreateUser(identity: Awaited<ReturnType<typeof requireSupabaseUser>>, username: string) {
  const prisma = getPrisma();
  const existing = await prisma.user.findFirst({ where: { OR: [{ supabaseAuthId: identity.uid }, { email: identity.email }] } });
  let user;
  if (existing) user = await prisma.user.update({ where: { id: existing.id }, data: { supabaseAuthId: identity.uid, email: identity.email } });
  else {
    let availableUsername = safeUsername(username || identity.name || "Handler", identity.uid);
    if (await prisma.user.findUnique({ where: { username: availableUsername } })) availableUsername = `Handler${identity.uid.slice(0, 8)}`;
    user = await prisma.user.create({ data: { supabaseAuthId: identity.uid, email: identity.email, username: availableUsername } });
  }
  for (const account of identity.accounts) {
    await prisma.authAccount.upsert({
      where: { userId_provider: { userId: user.id, provider: account.provider } },
      create: { userId: user.id, provider: account.provider, providerAccountId: account.providerAccountId, emailVerified: identity.emailVerified },
      update: { providerAccountId: account.providerAccountId, emailVerified: identity.emailVerified },
    });
  }
  return user;
}

async function synchronizeState(identity: Awaited<ReturnType<typeof requireSupabaseUser>>, state: PlayerState, activity: SyncBody["activity"], precedingActivities: NonNullable<SyncBody["precedingActivities"]> = []) {
  const prisma = getPrisma();
  const user = await findOrCreateUser(identity, state.account?.username ?? "Handler");
  const profileInput = state.profile;
  state.saveRevision = saveRevision(state);

  return prisma.$transaction(async (tx) => {
    // Serialize saves with admin balance adjustments for this profile.
    await tx.$queryRaw`SELECT id FROM "PlayerProfile" WHERE "userId" = ${user.id} FOR UPDATE`;
    // Multiple tabs or a slow request can deliver an older snapshot after a newer one. Never let
    // that stale write replace the canonical blob or its normalized profile/pack records.
    const currentSave = await tx.playerGameState.findFirst({
      where: { profile: { userId: user.id } },
      select: { state: true, version: true, updatedAt: true },
    });
    if (currentSave && saveRevision(currentSave.state) > state.saveRevision) {
      return { version: currentSave.version, updatedAt: currentSave.updatedAt };
    }

    const adjustments = await tx.adminAdjustmentTransaction.groupBy({
      by: ["currency"], where: { profile: { userId: user.id } }, _sum: { amount: true },
    });
    reconcileAdminBalance(state, {
      coins: adjustments.find(item => item.currency === "COINS")?._sum.amount ?? 0,
      premium: adjustments.find(item => item.currency === "PREMIUM")?._sum.amount ?? 0,
    });

    const profile = await tx.playerProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        level: state.level,
        xp: state.xp,
        coins: state.coins,
        premiumCurrency: state.premium,
        starterGranted: state.ownedCards.length > 0,
        wins: state.wins,
        losses: state.losses,
        tagline: profileInput?.tagline ?? "",
        region: profileInput?.region ?? "North America",
        allegiance: profileInput?.allegiance ?? "Mortalborn",
        avatarPath: profileInput?.avatarPath,
        favoriteMysticId: profileInput?.favoriteMysticId,
      },
      update: {
        level: state.level,
        xp: state.xp,
        coins: state.coins,
        premiumCurrency: state.premium,
        starterGranted: state.ownedCards.length > 0,
        wins: state.wins,
        losses: state.losses,
        tagline: profileInput?.tagline ?? "",
        region: profileInput?.region ?? "North America",
        allegiance: profileInput?.allegiance ?? "Mortalborn",
        avatarPath: profileInput?.avatarPath,
        favoriteMysticId: profileInput?.favoriteMysticId,
      },
    });

    const persistedProgression = await tx.playerProfile.findUniqueOrThrow({
      where: { id: profile.id },
      select: {
        lastDailyPackClaimAt: true,
        seasonProgress: { select: { seasonId: true, seasonXp: true, currentTier: true, claimedFree: true } },
        seasonRewardClaims: { select: { seasonId: true, tier: true, track: true } },
        challengeAssignments: { select: { definitionId: true, assignedDate: true, progress: true, progressData: true, completed: true, rewardClaimed: true, completedAt: true } },
      },
    });
    reconcileProgression(state, persistedProgression);

    const displayName = (profileInput?.handlerName ?? state.account?.username ?? user.username).trim();
    const normalizedName = displayName.toLowerCase();
    const nameOwner = await tx.handlerName.findUnique({ where: { normalizedName } });
    if (!nameOwner || nameOwner.userId === user.id) {
      await tx.handlerName.upsert({
        where: { userId: user.id },
        create: { userId: user.id, displayName, normalizedName },
        update: { displayName, normalizedName },
      });
      const usernameOwner = await tx.user.findUnique({ where: { username: displayName } });
      if (!usernameOwner || usernameOwner.id === user.id) await tx.user.update({ where: { id: user.id }, data: { username: displayName } });
    }

    // CampaignProgress is the normalized, monotonic record of earned clears. Merge it into an
    // incoming snapshot so a stale client can never erase an already-recorded completion.
    const persistedCampaignWins = await tx.campaignProgress.findMany({
      where: { profileId: profile.id },
      select: { opponentId: true },
    });
    state.campaignWins = [...new Set([
      ...state.campaignWins,
      ...persistedCampaignWins.map(({ opponentId }) => opponentId),
    ])];

    await tx.playerGameState.upsert({
      where: { profileId: profile.id },
      create: { profileId: profile.id, state: asJson(state) },
      update: { state: asJson(state), version: { increment: 1 } },
    });

    const activities = [...precedingActivities, activity].filter((item) => typeof item?.type === "string" && item.type);
    if (activities.length) {
      await tx.gameActivity.createMany({
        data: activities.map(item => ({ profileId: profile.id, type: item!.type!.slice(0, 80), payload: item!.payload ? asJson(item!.payload) : undefined })),
      });
    }

    if (activity?.type === "PACK_PURCHASED" && typeof activity.payload?.packId === "string") {
      const purchasedPack = await tx.packDefinition.findUnique({ where: { id: activity.payload.packId }, select: { coinPrice: true } });
      const openingId = state.activeOpeningId;
      if (purchasedPack && openingId) {
        await tx.currencyTransaction.upsert({
          where: { idempotencyKey: `pack-purchase:${openingId}` },
          create: { profileId: profile.id, currency: CurrencyKind.COINS, kind: "PURCHASE", amount: -purchasedPack.coinPrice, balanceAfter: state.coins, referenceType: "PackOpening", referenceId: openingId, idempotencyKey: `pack-purchase:${openingId}` },
          update: {},
        });
      }
    }

    for (const [volumeId, progress] of Object.entries(state.comicProgress ?? {})) {
      await tx.comicProgress.upsert({
        where: { profileId_volumeId: { profileId: profile.id, volumeId } },
        create: { profileId: profile.id, volumeId, pageIndex: progress.pageIndex, completed: progress.completed },
        update: { pageIndex: progress.pageIndex, completed: progress.completed },
      });
    }

    const currentCardIds = state.ownedCards.map((card) => card.id);
    if (currentCardIds.length) {
      for (const owned of state.ownedCards) {
        await tx.ownedCard.upsert({
          where: { id: owned.id },
          create: { id: owned.id, profileId: profile.id, definitionId: owned.definitionId, acquiredAt: date(owned.acquiredAt), acquisition: owned.seasonOrigin ? "SEASON_PASS" : "GAMEPLAY", level: owned.level ?? 1, variant: owned.variant ?? "standard", artworkVariant: owned.artworkVariant ?? "default" },
          update: { profileId: profile.id, definitionId: owned.definitionId, level: owned.level ?? 1, variant: owned.variant ?? "standard", artworkVariant: owned.artworkVariant ?? "default", soldAt: null },
        });
      }
      await tx.ownedCard.updateMany({ where: { profileId: profile.id, id: { notIn: currentCardIds }, soldAt: null }, data: { soldAt: new Date() } });
    }

    const inventory = new Map<string, { type: string; rarity: Rarity | null; quantity: number; matches: number[] }>();
    for (const item of state.inventory) {
      const itemRarity = rarity(item.rarity);
      const key = `${item.type}:${itemRarity ?? "NONE"}`;
      const current = inventory.get(key) ?? { type: item.type, rarity: itemRarity, quantity: 0, matches: [] };
      current.quantity += 1;
      current.matches.push(item.matches);
      inventory.set(key, current);
    }
    await tx.inventoryItem.deleteMany({ where: { profileId: profile.id } });
    for (const item of inventory.values()) {
      await tx.inventoryItem.create({ data: { profileId: profile.id, itemType: item.type, rarity: item.rarity, quantity: item.quantity, metadata: { matches: item.matches } } });
    }

    await tx.activeBoost.deleteMany({ where: { profileId: profile.id } });
    if (state.activeBoosts.xp) await tx.activeBoost.create({ data: { profileId: profile.id, kind: "XP", multiplier: state.activeBoosts.xp.multiplier, matchesRemaining: state.activeBoosts.xp.matches } });
    if (state.activeBoosts.coins) await tx.activeBoost.create({ data: { profileId: profile.id, kind: "COINS", multiplier: state.activeBoosts.coins.multiplier, matchesRemaining: state.activeBoosts.coins.matches } });

    await tx.pityCounter.upsert({
      where: { profileId_packId: { profileId: profile.id, packId: "standard" } },
      create: { profileId: profile.id, packId: "standard", counter: state.pity },
      update: { counter: state.pity },
    });

    for (const [order, amount] of Object.entries(state.essence ?? {})) {
      await tx.orderEssence.upsert({
        where: { profileId_order: { profileId: profile.id, order } },
        create: { profileId: profile.id, order, amount },
        update: { amount },
      });
    }

    const knownPacks = new Set((await tx.packDefinition.findMany({ where: { id: { in: state.openings.map((opening) => opening.packId) } }, select: { id: true } })).map((pack) => pack.id));
    for (const opening of state.openings.filter((item) => knownPacks.has(item.packId))) {
      await tx.packOpening.upsert({
        where: { id: opening.id },
        create: { id: opening.id, profileId: profile.id, packId: opening.packId, idempotencyKey: `opening:${opening.id}`, currency: opening.source === "purchase" || (!opening.source && opening.packId !== "starter") ? CurrencyKind.COINS : null },
        update: {},
      });
      for (const [position, result] of opening.cards.entries()) {
        await tx.packOpeningResult.upsert({
          where: { openingId_position: { openingId: opening.id, position } },
          create: { openingId: opening.id, position, resultType: result.kind, definitionId: result.definitionId, rarity: rarity(result.rarity), quantity: result.amount, metadata: { revealed: result.revealed } },
          update: { metadata: { revealed: result.revealed } },
        });
      }
    }

    for (const progress of Object.values(state.progression?.dailyChallenges ?? {})) {
      const definition = await tx.dailyChallengeDefinition.findUnique({ where: { id: progress.challengeId }, select: { id: true } });
      if (!definition) continue;
      const assignedDate = new Date(`${progress.challengeDate}T00:00:00.000Z`);
      await tx.dailyChallengeAssignment.upsert({
        where: { profileId_definitionId_assignedDate: { profileId: profile.id, definitionId: progress.challengeId, assignedDate } },
        create: { profileId: profile.id, definitionId: progress.challengeId, assignedDate, progress: Math.max(0, ...Object.values(progress.values)), progressData: asJson({ values: progress.values, sets: progress.sets, battleValues: progress.battleValues }), completed: progress.completed, rewardClaimed: progress.rewardClaimed, completedAt: progress.completedAt ? new Date(progress.completedAt) : null, claimedAt: progress.rewardClaimed ? new Date() : null },
        update: { progress: Math.max(0, ...Object.values(progress.values)), progressData: asJson({ values: progress.values, sets: progress.sets, battleValues: progress.battleValues }), completed: progress.completed, rewardClaimed: progress.rewardClaimed, completedAt: progress.completedAt ? new Date(progress.completedAt) : null, claimedAt: progress.rewardClaimed ? new Date() : undefined },
      });
    }
    for (const seasonProgress of Object.values(state.progression?.seasons ?? {})) {
      const season = await tx.season.findUnique({ where: { id: seasonProgress.seasonId }, select: { id: true } });
      if (!season) continue;
      await tx.playerSeasonProgress.upsert({
        where: { profileId_seasonId: { profileId: profile.id, seasonId: season.id } },
        create: { profileId: profile.id, seasonId: season.id, seasonXp: seasonProgress.seasonXp, currentTier: seasonProgress.currentTier, claimedFree: seasonProgress.claimedTiers, claimedPremium: [] },
        update: { seasonXp: seasonProgress.seasonXp, currentTier: seasonProgress.currentTier, claimedFree: seasonProgress.claimedTiers },
      });
      for (const tier of seasonProgress.claimedTiers) await tx.seasonPassRewardClaim.upsert({
        where: { profileId_seasonId_tier_track: { profileId: profile.id, seasonId: season.id, tier, track: "FREE" } },
        create: { profileId: profile.id, seasonId: season.id, tier, track: "FREE" }, update: {},
      });
    }

    await tx.savedLoadout.deleteMany({ where: { profileId: profile.id, id: { notIn: state.loadouts.map((loadout) => loadout.id) } } });
    for (const loadout of state.loadouts) {
      await tx.savedLoadout.upsert({ where: { id: loadout.id }, create: { id: loadout.id, profileId: profile.id, name: loadout.name, battleSize: loadout.size }, update: { name: loadout.name, battleSize: loadout.size } });
      await tx.savedLoadoutCard.deleteMany({ where: { loadoutId: loadout.id } });
      const cards = [
        ...loadout.mysticIds.map((ownedCardId, slot) => ({ ownedCardId, slot, kind: CardKind.MYSTIC })),
        ...loadout.handlerIds.map((ownedCardId, slot) => ({ ownedCardId, slot, kind: CardKind.HANDLER })),
      ].filter((card) => currentCardIds.includes(card.ownedCardId));
      if (cards.length) await tx.savedLoadoutCard.createMany({ data: cards.map((card) => ({ ...card, loadoutId: loadout.id })) });
    }

    await tx.customCollection.deleteMany({ where: { profileId: profile.id, id: { notIn: state.binders.map((binder) => binder.id) } } });
    for (const binder of state.binders) {
      await tx.customCollection.upsert({ where: { id: binder.id }, create: { id: binder.id, profileId: profile.id, name: binder.name }, update: { name: binder.name } });
      await tx.customCollectionCard.deleteMany({ where: { collectionId: binder.id } });
      const cardIds = binder.cardIds.filter((ownedCardId) => currentCardIds.includes(ownedCardId));
      if (cardIds.length) await tx.customCollectionCard.createMany({ data: cardIds.map((ownedCardId) => ({ collectionId: binder.id, ownedCardId })) });
    }

    // A client can briefly be newer than the database during a staged rollout. Preserve the
    // durable state blob instead of rolling the entire transaction back on CampaignProgress's
    // opponent foreign key; the next save backfills progress after definitions are deployed.
    const requestedOpponentIds = [...new Set(state.campaignWins)];
    const knownOpponentIds = new Set((await tx.campaignOpponent.findMany({
      where: { id: { in: requestedOpponentIds } },
      select: { id: true },
    })).map(({ id }) => id));
    for (const opponentId of requestedOpponentIds.filter((id) => knownOpponentIds.has(id))) {
      await tx.campaignProgress.upsert({ where: { profileId_opponentId: { profileId: profile.id, opponentId } }, create: { profileId: profile.id, opponentId, wins: 1 }, update: {} });
    }

    if (state.battle) {
      const battle = state.battle;
      const status = battle.winner ? MatchStatus.COMPLETE : MatchStatus.ACTIVE;
      const winnerSide = battle.winner === "player" ? MatchSide.PLAYER : battle.winner === "ai" ? MatchSide.OPPONENT : null;
      await tx.match.upsert({
        where: { id: battle.id },
        create: { id: battle.id, status, battleSize: battle.size, engineVersion: "prototype-1", state: asJson(battle), winnerSide, mode: MatchMode.CAMPAIGN, timing: MatchTiming.LIVE, lastActionAt: new Date(), completedAt: battle.winner ? new Date() : null },
        update: { status, state: asJson(battle), winnerSide, lastActionAt: new Date(), completedAt: battle.winner ? new Date() : null },
      });
      if (await tx.matchParticipant.count({ where: { matchId: battle.id } }) === 0) {
        await tx.matchParticipant.createMany({ data: [
          { matchId: battle.id, profileId: profile.id, side: MatchSide.PLAYER },
          { matchId: battle.id, side: MatchSide.OPPONENT, opponentId: battle.campaignId ?? battle.ai.name },
        ] });
      }
      for (const [sequence, event] of battle.events.entries()) {
        await tx.battleEvent.upsert({ where: { matchId_sequence: { matchId: battle.id, sequence } }, create: { matchId: battle.id, sequence, turn: event.turn, type: event.type, payload: asJson(event) }, update: { turn: event.turn, type: event.type, payload: asJson(event) } });
      }
      await tx.multiplayerStatistic.upsert({
        where: { profileId_battleSize: { profileId: profile.id, battleSize: battle.size } },
        create: { profileId: profile.id, battleSize: battle.size, wins: state.wins, losses: state.losses, currentStreak: profile.currentStreak, highestStreak: profile.peakStreak },
        update: { wins: state.wins, losses: state.losses, currentStreak: profile.currentStreak, highestStreak: profile.peakStreak },
      });
      if (state.battleRewarded && state.lastRewards && battle.winner) {
        await tx.rewardTransaction.upsert({
          where: { matchId: battle.id },
          create: { profileId: profile.id, matchId: battle.id, xp: state.lastRewards.xp, coins: state.lastRewards.coins + (state.lastRewards.campaignBonus ?? 0), calculation: asJson(state.lastRewards), idempotencyKey: `battle-reward:${battle.id}` },
          update: {},
        });
      }
    }

    return tx.playerGameState.findUniqueOrThrow({ where: { profileId: profile.id }, select: { version: true, updatedAt: true } });
  }, { maxWait: 10_000, timeout: 30_000 });
}

function errorResponse(cause: unknown) {
  const unauthorized = cause instanceof Error && cause.message === "UNAUTHORIZED";
  if (!unauthorized) console.error("Game state persistence failed", cause);
  return NextResponse.json({ error: unauthorized ? "Unauthorized" : "Could not save game state." }, { status: unauthorized ? 401 : 500 });
}

export async function GET(request: Request) {
  try {
    const identity = await requireSupabaseUser(request);
    const prisma = getPrisma();
    const save = await prisma.playerGameState.findFirst({
      where: { profile: { user: { OR: [{ supabaseAuthId: identity.uid }, { email: identity.email }] } } },
      include: { profile: { select: {
        adminAdjustments: { select: { currency: true, amount: true } },
        lastDailyPackClaimAt: true,
        campaign: { select: { opponentId: true } },
        seasonProgress: { select: { seasonId: true, seasonXp: true, currentTier: true, claimedFree: true } },
        seasonRewardClaims: { select: { seasonId: true, tier: true, track: true } },
        challengeAssignments: { select: { definitionId: true, assignedDate: true, progress: true, progressData: true, completed: true, rewardClaimed: true, completedAt: true } },
      } } },
    });
    if (!save) return NextResponse.json({ error: "No cloud save yet." }, { status: 404 });
    const state = structuredClone(save.state) as unknown as PlayerState;
    reconcileAdminBalance(state, {
      coins: save.profile.adminAdjustments.reduce((sum, item) => sum + (item.currency === "COINS" ? item.amount : 0), 0),
      premium: save.profile.adminAdjustments.reduce((sum, item) => sum + (item.currency === "PREMIUM" ? item.amount : 0), 0),
    });
    state.progression ??= emptyProgression();
    state.progression.configuration = await getRuntimeProgressionConfig(prisma);
    reconcileProgression(state, save.profile);
    state.campaignWins = [...new Set([
      ...(Array.isArray(state.campaignWins) ? state.campaignWins : []),
      ...save.profile.campaign.map(({ opponentId }) => opponentId),
    ])];
    return NextResponse.json({ state, version: save.version, updatedAt: save.updatedAt }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) {
    return errorResponse(cause);
  }
}

export async function POST(request: Request) {
  try {
    const identity = await requireSupabaseUser(request);
    const raw = await request.text();
    if (raw.length > 2_000_000) return NextResponse.json({ error: "Game state is too large." }, { status: 413 });
    const body = JSON.parse(raw) as SyncBody;
    if (!validState(body.state) || body.state.account?.email.toLowerCase() !== identity.email) {
      return NextResponse.json({ error: "Invalid game state." }, { status: 400 });
    }
    body.state.progression ??= emptyProgression();
    body.state.progression.configuration = await getRuntimeProgressionConfig(getPrisma());
    if (body.precedingActivities !== undefined && (!Array.isArray(body.precedingActivities) || body.precedingActivities.some(item => !item || typeof item.type !== "string" || item.type === "PACK_PURCHASED"))) {
      return NextResponse.json({ error: "Invalid game activities." }, { status: 400 });
    }
    const result = await synchronizeState(identity, body.state, body.activity, body.precedingActivities);
    return NextResponse.json({ ok: true, ...result });
  } catch (cause) {
    return errorResponse(cause);
  }
}
