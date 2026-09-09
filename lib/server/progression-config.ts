import type { Prisma } from "@prisma/client";
import type { ChallengeRequirement, SeasonReward } from "@/lib/progression/config";
import { defaultProgressionConfig, type RuntimeProgressionConfig } from "@/lib/progression/state";
import type { getPrisma } from "./prisma";

type ProgressionDatabase = ReturnType<typeof getPrisma> | Prisma.TransactionClient;

export async function getRuntimeProgressionConfig(database: ProgressionDatabase): Promise<RuntimeProgressionConfig> {
  const fallback = defaultProgressionConfig();
  const now = new Date();
  const [season, definitions] = await Promise.all([
    database.season.findFirst({
      where: { active: true, startsAt: { lte: now }, endsAt: { gt: now } },
      include: { tiers: { orderBy: { tierNumber: "asc" } } },
      orderBy: { number: "desc" },
    }),
    database.dailyChallengeDefinition.findMany({
      where: { active: true, rotationDay: { not: null } },
      orderBy: { rotationDay: "asc" },
    }),
  ]);
  const challenges = definitions.length === 30 ? definitions.map((item) => ({
    id: item.id,
    day: item.rotationDay!,
    name: item.name,
    description: item.description,
    requirements: (Array.isArray(item.filters) ? item.filters : []) as unknown as ChallengeRequirement[],
    seasonXp: item.seasonXpReward,
    coins: item.coinReward,
  })) : fallback.challenges;
  if (!season || season.tiers.length !== 50) return { ...fallback, challenges };
  const xp = season.xpConfig && typeof season.xpConfig === "object" && !Array.isArray(season.xpConfig)
    ? season.xpConfig as Record<string, unknown>
    : {};
  return {
    challenges,
    season: {
      id: season.id,
      number: season.number,
      name: season.name,
      startsAt: season.startsAt.toISOString(),
      endsAt: season.endsAt.toISOString(),
      xpSources: {
        battleComplete: Number(xp.battleComplete ?? 20),
        battleWin: Number(xp.battleWin ?? 30),
        firstBattleOfDay: Number(xp.firstBattleOfDay ?? 50),
      },
      thresholds: season.tiers.map((item) => item.xpRequirement),
      rewards: season.tiers.map((item, index) => (item.freeReward as unknown as SeasonReward | null) ?? fallback.season.rewards[index]),
    },
  };
}
