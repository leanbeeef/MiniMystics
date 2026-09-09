ALTER TABLE "PlayerProfile" ADD COLUMN "lastDailyPackClaimAt" TIMESTAMP(3);
ALTER TABLE "Season" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'UPCOMING';
ALTER TABLE "DailyChallengeDefinition"
  ADD COLUMN "rotationDay" INTEGER,
  ADD COLUMN "seasonXpReward" INTEGER NOT NULL DEFAULT 150,
  ADD COLUMN "coinReward" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "DailyChallengeAssignment"
  ADD COLUMN "progressData" JSONB,
  ADD COLUMN "completed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "rewardClaimed" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "DailyChallengeDefinition_rotationDay_key" ON "DailyChallengeDefinition"("rotationDay");

CREATE TABLE "SeasonPassRewardClaim" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "seasonId" TEXT NOT NULL,
  "tier" INTEGER NOT NULL,
  "track" TEXT NOT NULL DEFAULT 'FREE',
  "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeasonPassRewardClaim_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SeasonPassRewardClaim_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PlayerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SeasonPassRewardClaim_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SeasonPassRewardClaim_profileId_seasonId_tier_track_key" ON "SeasonPassRewardClaim"("profileId", "seasonId", "tier", "track");
CREATE INDEX "SeasonPassRewardClaim_seasonId_tier_idx" ON "SeasonPassRewardClaim"("seasonId", "tier");

CREATE TABLE "PlayerDailyReward" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "rewardDate" TIMESTAMP(3) NOT NULL,
  "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "packOpeningId" TEXT NOT NULL,
  CONSTRAINT "PlayerDailyReward_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PlayerDailyReward_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PlayerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PlayerDailyReward_packOpeningId_key" ON "PlayerDailyReward"("packOpeningId");
CREATE UNIQUE INDEX "PlayerDailyReward_profileId_rewardDate_key" ON "PlayerDailyReward"("profileId", "rewardDate");
CREATE INDEX "PlayerDailyReward_profileId_claimedAt_idx" ON "PlayerDailyReward"("profileId", "claimedAt");
