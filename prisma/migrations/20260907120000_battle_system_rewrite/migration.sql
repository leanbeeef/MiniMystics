-- AlterTable
ALTER TABLE "public"."HandlerDefinition" DROP COLUMN "activationDice",
DROP COLUMN "activationRoll",
DROP COLUMN "duration",
DROP COLUMN "effect",
DROP COLUMN "effectType",
DROP COLUMN "effectValue",
DROP COLUMN "maxUses",
DROP COLUMN "target",
DROP COLUMN "usageLimit",
ADD COLUMN     "allegiancePassiveEffect" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "allegiancePassiveName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "allegiancePassiveTarget" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "orderPassiveEffect" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "orderPassiveName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "orderPassiveTarget" TEXT NOT NULL DEFAULT '';
-- Temporary '' defaults let the ALTER succeed against the 9 existing HandlerDefinition rows;
-- prisma/seed.ts immediately backfills real values from cards.generated.json right after this
-- migration runs, and the defaults are dropped at the end of this file so the column definition
-- matches schema.prisma exactly (no @default declared there).

-- AlterTable
ALTER TABLE "public"."OwnedCard" ADD COLUMN     "level" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "public"."OrderEssence" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "order" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OrderEssence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RarityCardValue" (
    "rarity" "public"."Rarity" NOT NULL,
    "dismantleEssence" INTEGER NOT NULL,
    "sellCoins" INTEGER NOT NULL,

    CONSTRAINT "RarityCardValue_pkey" PRIMARY KEY ("rarity")
);

-- CreateTable
CREATE TABLE "public"."MysticLevelCost" (
    "level" INTEGER NOT NULL,
    "essenceCost" INTEGER NOT NULL,

    CONSTRAINT "MysticLevelCost_pkey" PRIMARY KEY ("level")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderEssence_profileId_order_key" ON "public"."OrderEssence"("profileId", "order");

-- AddForeignKey
ALTER TABLE "public"."OrderEssence" ADD CONSTRAINT "OrderEssence_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."PlayerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop the temporary defaults now that the columns exist (backfilled separately by prisma/seed.ts).
ALTER TABLE "public"."HandlerDefinition"
ALTER COLUMN "allegiancePassiveEffect" DROP DEFAULT,
ALTER COLUMN "allegiancePassiveName" DROP DEFAULT,
ALTER COLUMN "allegiancePassiveTarget" DROP DEFAULT,
ALTER COLUMN "orderPassiveEffect" DROP DEFAULT,
ALTER COLUMN "orderPassiveName" DROP DEFAULT,
ALTER COLUMN "orderPassiveTarget" DROP DEFAULT;

