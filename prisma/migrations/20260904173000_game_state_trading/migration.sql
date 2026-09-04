-- Durable Firebase-linked game state, activity tracking, comics, trades, and marketplace relations.
ALTER TABLE "public"."User" ADD COLUMN "firebaseUid" TEXT;
ALTER TABLE "public"."User" ALTER COLUMN "passwordHash" DROP NOT NULL;
CREATE UNIQUE INDEX "User_firebaseUid_key" ON "public"."User"("firebaseUid");

CREATE TYPE "public"."TradeStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'COMPLETED');
CREATE TYPE "public"."TradeSide" AS ENUM ('OFFERED', 'REQUESTED');
CREATE TYPE "public"."MarketplaceListingStatus" AS ENUM ('ACTIVE', 'SOLD', 'CANCELLED', 'EXPIRED');

CREATE TABLE "public"."PlayerGameState" (
  "profileId" TEXT NOT NULL,
  "state" JSONB NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlayerGameState_pkey" PRIMARY KEY ("profileId")
);

CREATE TABLE "public"."GameActivity" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GameActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."ComicProgress" (
  "profileId" TEXT NOT NULL,
  "volumeId" TEXT NOT NULL,
  "pageIndex" INTEGER NOT NULL,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ComicProgress_pkey" PRIMARY KEY ("profileId", "volumeId")
);

CREATE TABLE "public"."TradeOffer" (
  "id" TEXT NOT NULL,
  "senderProfileId" TEXT NOT NULL,
  "recipientProfileId" TEXT NOT NULL,
  "status" "public"."TradeStatus" NOT NULL DEFAULT 'PENDING',
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "TradeOffer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."TradeOfferItem" (
  "id" TEXT NOT NULL,
  "tradeId" TEXT NOT NULL,
  "side" "public"."TradeSide" NOT NULL,
  "ownedCardId" TEXT NOT NULL,
  CONSTRAINT "TradeOfferItem_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "public"."MarketplaceListing"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "public"."MarketplaceListingStatus"
    USING (CASE
      WHEN UPPER("status") IN ('ACTIVE', 'SOLD', 'CANCELLED', 'EXPIRED') THEN UPPER("status")
      ELSE 'ACTIVE'
    END)::"public"."MarketplaceListingStatus",
  ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

CREATE INDEX "GameActivity_profileId_createdAt_idx" ON "public"."GameActivity"("profileId", "createdAt");
CREATE INDEX "GameActivity_type_createdAt_idx" ON "public"."GameActivity"("type", "createdAt");
CREATE INDEX "TradeOffer_senderProfileId_status_createdAt_idx" ON "public"."TradeOffer"("senderProfileId", "status", "createdAt");
CREATE INDEX "TradeOffer_recipientProfileId_status_createdAt_idx" ON "public"."TradeOffer"("recipientProfileId", "status", "createdAt");
CREATE UNIQUE INDEX "TradeOfferItem_tradeId_ownedCardId_key" ON "public"."TradeOfferItem"("tradeId", "ownedCardId");
CREATE INDEX "TradeOfferItem_ownedCardId_idx" ON "public"."TradeOfferItem"("ownedCardId");
CREATE INDEX "MarketplaceListing_status_createdAt_idx" ON "public"."MarketplaceListing"("status", "createdAt");
CREATE INDEX "MarketplaceListing_sellerId_status_idx" ON "public"."MarketplaceListing"("sellerId", "status");
CREATE INDEX "MarketplaceSale_sellerId_completedAt_idx" ON "public"."MarketplaceSale"("sellerId", "completedAt");
CREATE INDEX "MarketplaceSale_buyerId_completedAt_idx" ON "public"."MarketplaceSale"("buyerId", "completedAt");

ALTER TABLE "public"."PlayerGameState" ADD CONSTRAINT "PlayerGameState_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."PlayerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."GameActivity" ADD CONSTRAINT "GameActivity_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."PlayerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."ComicProgress" ADD CONSTRAINT "ComicProgress_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."PlayerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."TradeOffer" ADD CONSTRAINT "TradeOffer_senderProfileId_fkey" FOREIGN KEY ("senderProfileId") REFERENCES "public"."PlayerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."TradeOffer" ADD CONSTRAINT "TradeOffer_recipientProfileId_fkey" FOREIGN KEY ("recipientProfileId") REFERENCES "public"."PlayerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."TradeOfferItem" ADD CONSTRAINT "TradeOfferItem_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "public"."TradeOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."TradeOfferItem" ADD CONSTRAINT "TradeOfferItem_ownedCardId_fkey" FOREIGN KEY ("ownedCardId") REFERENCES "public"."OwnedCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."MarketplaceListing" ADD CONSTRAINT "MarketplaceListing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "public"."PlayerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."MarketplaceListing" ADD CONSTRAINT "MarketplaceListing_ownedCardId_fkey" FOREIGN KEY ("ownedCardId") REFERENCES "public"."OwnedCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."MarketplaceSale" ADD CONSTRAINT "MarketplaceSale_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "public"."MarketplaceListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."MarketplaceSale" ADD CONSTRAINT "MarketplaceSale_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "public"."CardDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."MarketplaceSale" ADD CONSTRAINT "MarketplaceSale_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "public"."PlayerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."MarketplaceSale" ADD CONSTRAINT "MarketplaceSale_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "public"."PlayerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
