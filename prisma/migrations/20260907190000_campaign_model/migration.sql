-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "order" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_order_key" ON "Campaign"("order");

-- AlterTable
ALTER TABLE "CampaignOpponent" ADD COLUMN     "campaignId" TEXT,
ADD COLUMN     "stageNumber" INTEGER;

-- AddForeignKey
ALTER TABLE "CampaignOpponent" ADD CONSTRAINT "CampaignOpponent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
