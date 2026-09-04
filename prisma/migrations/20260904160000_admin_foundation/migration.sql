-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."CardKind" AS ENUM ('MYSTIC', 'HANDLER');

-- CreateEnum
CREATE TYPE "public"."Rarity" AS ENUM ('WILD', 'HUNTER', 'PREDATOR', 'PRIME', 'ALPHA', 'APEX');

-- CreateEnum
CREATE TYPE "public"."CurrencyKind" AS ENUM ('COINS', 'PREMIUM');

-- CreateEnum
CREATE TYPE "public"."TransactionKind" AS ENUM ('GRANT', 'PURCHASE', 'REWARD', 'SALE', 'REDEEM', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "public"."MatchStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETE', 'ABANDONED');

-- CreateEnum
CREATE TYPE "public"."MatchSide" AS ENUM ('PLAYER', 'OPPONENT');

-- CreateEnum
CREATE TYPE "public"."BoostKind" AS ENUM ('XP', 'COINS');

-- CreateEnum
CREATE TYPE "public"."AdminRole" AS ENUM ('SUPER_ADMIN', 'GAME_ADMIN', 'MODERATOR', 'SUPPORT');

-- CreateEnum
CREATE TYPE "public"."AuthProvider" AS ENUM ('CREDENTIALS', 'GOOGLE');

-- CreateEnum
CREATE TYPE "public"."ModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REMOVED');

-- CreateEnum
CREATE TYPE "public"."FriendshipStatus" AS ENUM ('PENDING', 'FRIENDS', 'BLOCKED', 'REMOVED');

-- CreateEnum
CREATE TYPE "public"."MatchMode" AS ENUM ('CAMPAIGN', 'RANKED', 'SOCIAL');

-- CreateEnum
CREATE TYPE "public"."MatchTiming" AS ENUM ('LIVE', 'ASYNC');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuthAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "public"."AuthProvider" NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."HandlerName" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "forcedRename" BOOLEAN NOT NULL DEFAULT false,
    "prohibitedAt" TIMESTAMP(3),
    "prohibitedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HandlerName_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PlayerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "coins" INTEGER NOT NULL DEFAULT 800,
    "premiumCurrency" INTEGER NOT NULL DEFAULT 0,
    "rankedRating" INTEGER NOT NULL DEFAULT 1000,
    "starterGranted" BOOLEAN NOT NULL DEFAULT false,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "tagline" TEXT NOT NULL DEFAULT '',
    "region" TEXT NOT NULL DEFAULT 'North America',
    "allegiance" TEXT NOT NULL DEFAULT 'Mortalborn',
    "avatarPath" TEXT,
    "favoriteMysticId" TEXT,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "peakStreak" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PlayerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Friendship" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "addresseeId" TEXT NOT NULL,
    "status" "public"."FriendshipStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AvatarUpload" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "privateObjectKey" TEXT NOT NULL,
    "publicObjectKey" TEXT,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "moderationStatus" "public"."ModerationStatus" NOT NULL DEFAULT 'PENDING',
    "automatedResult" TEXT,
    "automatedScore" DOUBLE PRECISION,
    "automatedDetails" JSONB,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AvatarUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProhibitedHandlerName" (
    "id" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "matchType" TEXT NOT NULL DEFAULT 'EXACT',
    "reason" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProhibitedHandlerName_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ModerationRecord" (
    "id" TEXT NOT NULL,
    "profileId" TEXT,
    "type" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "status" "public"."ModerationStatus" NOT NULL DEFAULT 'PENDING',
    "automatedData" JSONB,
    "reason" TEXT,
    "notes" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModerationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CardDefinition" (
    "id" TEXT NOT NULL,
    "kind" "public"."CardKind" NOT NULL,
    "name" TEXT NOT NULL,
    "order" TEXT NOT NULL,
    "allegiance" TEXT NOT NULL,
    "rarity" "public"."Rarity",
    "sourceRarity" TEXT NOT NULL,
    "imageFilename" TEXT,
    "edition" TEXT DEFAULT 'base',
    "variant" TEXT DEFAULT 'standard',
    "finish" TEXT DEFAULT 'normal',
    "artworkVariant" TEXT DEFAULT 'default',
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CardDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MysticDefinition" (
    "id" TEXT NOT NULL,
    "power" INTEGER NOT NULL,
    "defense" INTEGER NOT NULL,
    "baseAttack" INTEGER NOT NULL,
    "rawMoves" TEXT NOT NULL,
    "movesJson" JSONB NOT NULL,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MysticDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."HandlerDefinition" (
    "id" TEXT NOT NULL,
    "activationRoll" TEXT NOT NULL,
    "activationDice" INTEGER NOT NULL,
    "effect" TEXT NOT NULL,
    "effectType" TEXT NOT NULL,
    "effectValue" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "usageLimit" TEXT NOT NULL,
    "maxUses" INTEGER NOT NULL,
    "target" TEXT NOT NULL,
    "notes" TEXT NOT NULL,

    CONSTRAINT "HandlerDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OwnedCard" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acquisition" TEXT NOT NULL,
    "edition" TEXT NOT NULL DEFAULT 'base',
    "variant" TEXT NOT NULL DEFAULT 'standard',
    "finish" TEXT NOT NULL DEFAULT 'normal',
    "artworkVariant" TEXT NOT NULL DEFAULT 'default',
    "soldAt" TIMESTAMP(3),

    CONSTRAINT "OwnedCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."InventoryItem" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "rarity" "public"."Rarity",
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "boostDefinitionId" TEXT,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BoostDefinition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "public"."BoostKind" NOT NULL,
    "multiplier" INTEGER NOT NULL DEFAULT 2,
    "matchCount" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,

    CONSTRAINT "BoostDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ActiveBoost" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "kind" "public"."BoostKind" NOT NULL,
    "multiplier" INTEGER NOT NULL DEFAULT 2,
    "matchesRemaining" INTEGER NOT NULL,

    CONSTRAINT "ActiveBoost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PackDefinition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "cardCount" INTEGER NOT NULL,
    "poolConfig" JSONB NOT NULL,
    "rarityWeights" JSONB NOT NULL,
    "guaranteedSlots" JSONB NOT NULL,
    "coinPrice" INTEGER NOT NULL,
    "premiumPrice" INTEGER,
    "eligibilityRules" JSONB,
    "pityRules" JSONB,
    "theme" TEXT NOT NULL,
    "artwork" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),

    CONSTRAINT "PackDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PackOpening" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "currency" "public"."CurrencyKind",
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackOpening_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PackOpeningResult" (
    "id" TEXT NOT NULL,
    "openingId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "resultType" TEXT NOT NULL,
    "definitionId" TEXT,
    "rarity" "public"."Rarity",
    "quantity" INTEGER,
    "metadata" JSONB,

    CONSTRAINT "PackOpeningResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PityCounter" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "counter" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PityCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SavedLoadout" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "battleSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedLoadout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SavedLoadoutCard" (
    "id" TEXT NOT NULL,
    "loadoutId" TEXT NOT NULL,
    "ownedCardId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "kind" "public"."CardKind" NOT NULL,

    CONSTRAINT "SavedLoadoutCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomCollection" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomCollectionCard" (
    "collectionId" TEXT NOT NULL,
    "ownedCardId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomCollectionCard_pkey" PRIMARY KEY ("collectionId","ownedCardId")
);

-- CreateTable
CREATE TABLE "public"."CampaignOpponent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "playstyle" TEXT NOT NULL,
    "deckConfig" JSONB NOT NULL,
    "rewardConfig" JSONB NOT NULL,
    "unlockLevel" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CampaignOpponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CampaignProgress" (
    "profileId" TEXT NOT NULL,
    "opponentId" TEXT NOT NULL,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "bestResult" JSONB,

    CONSTRAINT "CampaignProgress_pkey" PRIMARY KEY ("profileId","opponentId")
);

-- CreateTable
CREATE TABLE "public"."Match" (
    "id" TEXT NOT NULL,
    "status" "public"."MatchStatus" NOT NULL,
    "battleSize" INTEGER NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "winnerSide" "public"."MatchSide",
    "mode" "public"."MatchMode" NOT NULL DEFAULT 'CAMPAIGN',
    "timing" "public"."MatchTiming" NOT NULL DEFAULT 'LIVE',
    "currentTurnProfileId" TEXT,
    "turnDeadline" TIMESTAMP(3),
    "lastActionAt" TIMESTAMP(3),
    "forfeitedTurns" INTEGER NOT NULL DEFAULT 0,
    "disconnectEvents" JSONB,
    "ratingChanges" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RankDefinition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "artworkPath" TEXT NOT NULL,
    "divisions" JSONB NOT NULL,
    "minimumRating" INTEGER NOT NULL,
    "maximumRating" INTEGER,
    "ratingGainConfig" JSONB NOT NULL,
    "ratingLossConfig" JSONB NOT NULL,
    "matchmakingConfig" JSONB NOT NULL,
    "placementConfig" JSONB NOT NULL,
    "resetConfig" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RankDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RankedRating" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "battleSize" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 1000,
    "rankId" TEXT NOT NULL,
    "division" INTEGER,
    "peakRating" INTEGER NOT NULL DEFAULT 1000,
    "peakRank" TEXT NOT NULL DEFAULT 'Wild III',
    "placementGames" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RankedRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RankHistory" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "seasonId" TEXT,
    "battleSize" INTEGER NOT NULL,
    "oldRating" INTEGER NOT NULL,
    "newRating" INTEGER NOT NULL,
    "oldRank" TEXT NOT NULL,
    "newRank" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "matchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RankHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MultiplayerStatistic" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "battleSize" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "highestStreak" INTEGER NOT NULL DEFAULT 0,
    "topMysticId" TEXT,
    "mostUsedMysticId" TEXT,
    "totalDamage" INTEGER NOT NULL DEFAULT 0,
    "totalTurns" INTEGER NOT NULL DEFAULT 0,
    "totalMysticsDefeated" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MultiplayerStatistic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LeaderboardRecord" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "seasonId" TEXT,
    "battleSize" INTEGER,
    "rankPosition" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL,
    "losses" INTEGER NOT NULL,
    "winPercentage" DOUBLE PRECISION NOT NULL,
    "topMysticId" TEXT,
    "mostUsedMysticId" TEXT,
    "averageDamage" DOUBLE PRECISION NOT NULL,
    "currentStreak" INTEGER NOT NULL,
    "peakRank" TEXT NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaderboardRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Season" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "artworkPath" TEXT,
    "rankedResetConfig" JSONB NOT NULL,
    "xpConfig" JSONB NOT NULL,
    "premiumTrackEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SeasonPassTier" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "tierNumber" INTEGER NOT NULL,
    "xpRequirement" INTEGER NOT NULL,
    "freeReward" JSONB,
    "premiumReward" JSONB,
    "assetPath" TEXT,
    "rewardMetadata" JSONB,

    CONSTRAINT "SeasonPassTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PlayerSeasonProgress" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "seasonXp" INTEGER NOT NULL DEFAULT 0,
    "currentTier" INTEGER NOT NULL DEFAULT 0,
    "premiumUnlocked" BOOLEAN NOT NULL DEFAULT false,
    "claimedFree" JSONB NOT NULL,
    "claimedPremium" JSONB NOT NULL,
    "finalRank" JSONB,
    "peakRank" JSONB,
    "finalWins" INTEGER,
    "finalWinRate" DOUBLE PRECISION,
    "leaderboardFinish" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerSeasonProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DailyChallengeDefinition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "targetValue" INTEGER NOT NULL,
    "filters" JSONB NOT NULL,
    "allowedGameModes" JSONB NOT NULL,
    "battleSizeRestrictions" JSONB NOT NULL,
    "orderRestrictions" JSONB NOT NULL,
    "allegianceRestrictions" JSONB NOT NULL,
    "rarityRestrictions" JSONB NOT NULL,
    "rewardType" TEXT NOT NULL,
    "rewardAmount" INTEGER NOT NULL,
    "difficulty" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "seasonId" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyChallengeDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DailyChallengeAssignment" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "assignedDate" TIMESTAMP(3) NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "rerolled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyChallengeAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MatchParticipant" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "profileId" TEXT,
    "side" "public"."MatchSide" NOT NULL,
    "opponentId" TEXT,

    CONSTRAINT "MatchParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MatchCardState" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "side" "public"."MatchSide" NOT NULL,
    "ownedCardId" TEXT,
    "definitionId" TEXT NOT NULL,
    "state" JSONB NOT NULL,

    CONSTRAINT "MatchCardState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MatchHandlerState" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "side" "public"."MatchSide" NOT NULL,
    "definitionId" TEXT NOT NULL,
    "state" JSONB NOT NULL,

    CONSTRAINT "MatchHandlerState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BattleEvent" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "turn" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BattleEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RewardTransaction" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "matchId" TEXT,
    "xp" INTEGER NOT NULL,
    "coins" INTEGER NOT NULL,
    "calculation" JSONB NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CurrencyTransaction" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "currency" "public"."CurrencyKind" NOT NULL,
    "kind" "public"."TransactionKind" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CurrencyTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AdminAdjustmentTransaction" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "currency" "public"."CurrencyKind" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceBefore" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAdjustmentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "public"."AdminRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AdminAuditLog" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "recordId" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "reason" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MarketplaceListing" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "ownedCardId" TEXT NOT NULL,
    "coinPrice" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "MarketplaceListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MarketplaceSale" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "coinPrice" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceSale_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "public"."User"("username");

-- CreateIndex
CREATE INDEX "AuthAccount_userId_idx" ON "public"."AuthAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthAccount_provider_providerAccountId_key" ON "public"."AuthAccount"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthAccount_userId_provider_key" ON "public"."AuthAccount"("userId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "HandlerName_userId_key" ON "public"."HandlerName"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "HandlerName_normalizedName_key" ON "public"."HandlerName"("normalizedName");

-- CreateIndex
CREATE INDEX "HandlerName_normalizedName_idx" ON "public"."HandlerName"("normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "public"."Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "public"."Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerProfile_userId_key" ON "public"."PlayerProfile"("userId");

-- CreateIndex
CREATE INDEX "Friendship_addresseeId_status_idx" ON "public"."Friendship"("addresseeId", "status");

-- CreateIndex
CREATE INDEX "Friendship_requesterId_status_idx" ON "public"."Friendship"("requesterId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Friendship_requesterId_addresseeId_key" ON "public"."Friendship"("requesterId", "addresseeId");

-- CreateIndex
CREATE INDEX "AvatarUpload_moderationStatus_uploadedAt_idx" ON "public"."AvatarUpload"("moderationStatus", "uploadedAt");

-- CreateIndex
CREATE INDEX "AvatarUpload_profileId_idx" ON "public"."AvatarUpload"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "ProhibitedHandlerName_normalizedName_key" ON "public"."ProhibitedHandlerName"("normalizedName");

-- CreateIndex
CREATE INDEX "ProhibitedHandlerName_active_normalizedName_idx" ON "public"."ProhibitedHandlerName"("active", "normalizedName");

-- CreateIndex
CREATE INDEX "ModerationRecord_status_type_createdAt_idx" ON "public"."ModerationRecord"("status", "type", "createdAt");

-- CreateIndex
CREATE INDEX "ModerationRecord_targetId_idx" ON "public"."ModerationRecord"("targetId");

-- CreateIndex
CREATE INDEX "OwnedCard_profileId_definitionId_idx" ON "public"."OwnedCard"("profileId", "definitionId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_profileId_itemType_rarity_key" ON "public"."InventoryItem"("profileId", "itemType", "rarity");

-- CreateIndex
CREATE UNIQUE INDEX "ActiveBoost_profileId_kind_key" ON "public"."ActiveBoost"("profileId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "PackOpening_idempotencyKey_key" ON "public"."PackOpening"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "PackOpeningResult_openingId_position_key" ON "public"."PackOpeningResult"("openingId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "PityCounter_profileId_packId_key" ON "public"."PityCounter"("profileId", "packId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedLoadoutCard_loadoutId_kind_slot_key" ON "public"."SavedLoadoutCard"("loadoutId", "kind", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "RankDefinition_name_key" ON "public"."RankDefinition"("name");

-- CreateIndex
CREATE UNIQUE INDEX "RankDefinition_sortOrder_key" ON "public"."RankDefinition"("sortOrder");

-- CreateIndex
CREATE INDEX "RankedRating_battleSize_rating_idx" ON "public"."RankedRating"("battleSize", "rating");

-- CreateIndex
CREATE UNIQUE INDEX "RankedRating_profileId_battleSize_key" ON "public"."RankedRating"("profileId", "battleSize");

-- CreateIndex
CREATE INDEX "RankHistory_profileId_battleSize_createdAt_idx" ON "public"."RankHistory"("profileId", "battleSize", "createdAt");

-- CreateIndex
CREATE INDEX "RankHistory_seasonId_idx" ON "public"."RankHistory"("seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "MultiplayerStatistic_profileId_battleSize_key" ON "public"."MultiplayerStatistic"("profileId", "battleSize");

-- CreateIndex
CREATE INDEX "LeaderboardRecord_seasonId_battleSize_rankPosition_idx" ON "public"."LeaderboardRecord"("seasonId", "battleSize", "rankPosition");

-- CreateIndex
CREATE UNIQUE INDEX "LeaderboardRecord_profileId_seasonId_battleSize_key" ON "public"."LeaderboardRecord"("profileId", "seasonId", "battleSize");

-- CreateIndex
CREATE UNIQUE INDEX "Season_number_key" ON "public"."Season"("number");

-- CreateIndex
CREATE UNIQUE INDEX "SeasonPassTier_seasonId_tierNumber_key" ON "public"."SeasonPassTier"("seasonId", "tierNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerSeasonProgress_profileId_seasonId_key" ON "public"."PlayerSeasonProgress"("profileId", "seasonId");

-- CreateIndex
CREATE INDEX "DailyChallengeDefinition_active_startsAt_endsAt_idx" ON "public"."DailyChallengeDefinition"("active", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "DailyChallengeAssignment_profileId_assignedDate_idx" ON "public"."DailyChallengeAssignment"("profileId", "assignedDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailyChallengeAssignment_profileId_definitionId_assignedDat_key" ON "public"."DailyChallengeAssignment"("profileId", "definitionId", "assignedDate");

-- CreateIndex
CREATE UNIQUE INDEX "BattleEvent_matchId_sequence_key" ON "public"."BattleEvent"("matchId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "RewardTransaction_matchId_key" ON "public"."RewardTransaction"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "RewardTransaction_idempotencyKey_key" ON "public"."RewardTransaction"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "CurrencyTransaction_idempotencyKey_key" ON "public"."CurrencyTransaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AdminAdjustmentTransaction_profileId_createdAt_idx" ON "public"."AdminAdjustmentTransaction"("profileId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAdjustmentTransaction_adminUserId_createdAt_idx" ON "public"."AdminAdjustmentTransaction"("adminUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "public"."AdminUser"("email");

-- CreateIndex
CREATE INDEX "AdminAuditLog_adminUserId_createdAt_idx" ON "public"."AdminAuditLog"("adminUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_resource_recordId_createdAt_idx" ON "public"."AdminAuditLog"("resource", "recordId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceSale_listingId_key" ON "public"."MarketplaceSale"("listingId");

-- CreateIndex
CREATE INDEX "MarketplaceSale_definitionId_completedAt_idx" ON "public"."MarketplaceSale"("definitionId", "completedAt");

-- AddForeignKey
ALTER TABLE "public"."AuthAccount" ADD CONSTRAINT "AuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HandlerName" ADD CONSTRAINT "HandlerName_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PlayerProfile" ADD CONSTRAINT "PlayerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Friendship" ADD CONSTRAINT "Friendship_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "public"."PlayerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Friendship" ADD CONSTRAINT "Friendship_addresseeId_fkey" FOREIGN KEY ("addresseeId") REFERENCES "public"."PlayerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AvatarUpload" ADD CONSTRAINT "AvatarUpload_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."PlayerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AvatarUpload" ADD CONSTRAINT "AvatarUpload_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "public"."AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProhibitedHandlerName" ADD CONSTRAINT "ProhibitedHandlerName_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ModerationRecord" ADD CONSTRAINT "ModerationRecord_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."PlayerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ModerationRecord" ADD CONSTRAINT "ModerationRecord_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "public"."AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MysticDefinition" ADD CONSTRAINT "MysticDefinition_id_fkey" FOREIGN KEY ("id") REFERENCES "public"."CardDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HandlerDefinition" ADD CONSTRAINT "HandlerDefinition_id_fkey" FOREIGN KEY ("id") REFERENCES "public"."CardDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OwnedCard" ADD CONSTRAINT "OwnedCard_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."PlayerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OwnedCard" ADD CONSTRAINT "OwnedCard_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "public"."CardDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InventoryItem" ADD CONSTRAINT "InventoryItem_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."PlayerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InventoryItem" ADD CONSTRAINT "InventoryItem_boostDefinitionId_fkey" FOREIGN KEY ("boostDefinitionId") REFERENCES "public"."BoostDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ActiveBoost" ADD CONSTRAINT "ActiveBoost_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."PlayerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PackOpening" ADD CONSTRAINT "PackOpening_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."PlayerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PackOpening" ADD CONSTRAINT "PackOpening_packId_fkey" FOREIGN KEY ("packId") REFERENCES "public"."PackDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PackOpeningResult" ADD CONSTRAINT "PackOpeningResult_openingId_fkey" FOREIGN KEY ("openingId") REFERENCES "public"."PackOpening"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PackOpeningResult" ADD CONSTRAINT "PackOpeningResult_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "public"."CardDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PityCounter" ADD CONSTRAINT "PityCounter_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."PlayerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SavedLoadout" ADD CONSTRAINT "SavedLoadout_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."PlayerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SavedLoadoutCard" ADD CONSTRAINT "SavedLoadoutCard_loadoutId_fkey" FOREIGN KEY ("loadoutId") REFERENCES "public"."SavedLoadout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SavedLoadoutCard" ADD CONSTRAINT "SavedLoadoutCard_ownedCardId_fkey" FOREIGN KEY ("ownedCardId") REFERENCES "public"."OwnedCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomCollection" ADD CONSTRAINT "CustomCollection_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."PlayerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomCollectionCard" ADD CONSTRAINT "CustomCollectionCard_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "public"."CustomCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomCollectionCard" ADD CONSTRAINT "CustomCollectionCard_ownedCardId_fkey" FOREIGN KEY ("ownedCardId") REFERENCES "public"."OwnedCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CampaignProgress" ADD CONSTRAINT "CampaignProgress_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."PlayerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CampaignProgress" ADD CONSTRAINT "CampaignProgress_opponentId_fkey" FOREIGN KEY ("opponentId") REFERENCES "public"."CampaignOpponent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RankedRating" ADD CONSTRAINT "RankedRating_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."PlayerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RankedRating" ADD CONSTRAINT "RankedRating_rankId_fkey" FOREIGN KEY ("rankId") REFERENCES "public"."RankDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RankHistory" ADD CONSTRAINT "RankHistory_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."PlayerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RankHistory" ADD CONSTRAINT "RankHistory_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "public"."Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MultiplayerStatistic" ADD CONSTRAINT "MultiplayerStatistic_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."PlayerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LeaderboardRecord" ADD CONSTRAINT "LeaderboardRecord_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."PlayerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LeaderboardRecord" ADD CONSTRAINT "LeaderboardRecord_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "public"."Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SeasonPassTier" ADD CONSTRAINT "SeasonPassTier_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "public"."Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PlayerSeasonProgress" ADD CONSTRAINT "PlayerSeasonProgress_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."PlayerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PlayerSeasonProgress" ADD CONSTRAINT "PlayerSeasonProgress_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "public"."Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DailyChallengeDefinition" ADD CONSTRAINT "DailyChallengeDefinition_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "public"."Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DailyChallengeAssignment" ADD CONSTRAINT "DailyChallengeAssignment_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."PlayerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DailyChallengeAssignment" ADD CONSTRAINT "DailyChallengeAssignment_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "public"."DailyChallengeDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MatchParticipant" ADD CONSTRAINT "MatchParticipant_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "public"."Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MatchParticipant" ADD CONSTRAINT "MatchParticipant_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."PlayerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MatchCardState" ADD CONSTRAINT "MatchCardState_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "public"."Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MatchHandlerState" ADD CONSTRAINT "MatchHandlerState_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "public"."Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BattleEvent" ADD CONSTRAINT "BattleEvent_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "public"."Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RewardTransaction" ADD CONSTRAINT "RewardTransaction_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."PlayerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CurrencyTransaction" ADD CONSTRAINT "CurrencyTransaction_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."PlayerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AdminAdjustmentTransaction" ADD CONSTRAINT "AdminAdjustmentTransaction_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "public"."AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AdminAdjustmentTransaction" ADD CONSTRAINT "AdminAdjustmentTransaction_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."PlayerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "public"."AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
