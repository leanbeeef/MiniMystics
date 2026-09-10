export type ProgressMetric = "battleWon" | "battleCompleted" | "specialAttempted" | "specialSucceeded" | "handlerSucceeded" | "damageDealt" | "basicLanded" | "attackLanded" | "distinctOrders" | "uniqueWinningLineups" | "winStreak";
export type ChallengeRequirement = {
  metric: ProgressMetric;
  target: number;
  order?: string;
  onlyOrder?: string;
  minOrderCount?: number;
  teamSize?: 3 | 5 | 8;
  minSurvivors?: number;
  requireAllyDefeated?: boolean;
  minSurvivorPowerPercent?: number;
  singleBattle?: boolean;
};
export type DailyChallenge = {
  id: string;
  day: number;
  name: string;
  description: string;
  requirements: ChallengeRequirement[];
  seasonXp: number;
  coins: number;
};

const winOrder = (day: number, name: string, order: string): DailyChallenge => ({
  id: `daily-${String(day).padStart(2, "0")}`, day, name,
  description: `Win a battle using at least 3 ${order} Mystics.`,
  requirements: [{ metric: "battleWon", target: 1, order, minOrderCount: 3 }], seasonXp: 150, coins: 100,
});
const challenge = (day: number, name: string, description: string, requirements: ChallengeRequirement[], seasonXp = 150, coins = 100): DailyChallenge =>
  ({ id: `daily-${String(day).padStart(2, "0")}`, day, name, description, requirements, seasonXp, coins });

export const DAILY_CHALLENGES: DailyChallenge[] = [
  challenge(1, "Sovereign Victory", "Win a 5v5 battle using only Sovereign Order Mystics.", [{ metric: "battleWon", target: 1, onlyOrder: "Sovereign Order", minOrderCount: 5, teamSize: 5 }]),
  challenge(2, "Specialist", "Successfully activate 3 Special Moves across any battles.", [{ metric: "specialSucceeded", target: 3 }]),
  winOrder(3, "Verdant Victory", "Verdant Dawn"),
  challenge(4, "Heavy Hitter", "Deal 300 total damage across battles.", [{ metric: "damageDealt", target: 300 }]),
  challenge(5, "Handler Assistance", "Successfully benefit from a Handler ability 2 times.", [{ metric: "handlerSucceeded", target: 2 }]),
  winOrder(6, "Sunspire Squad", "Sunspire"),
  challenge(7, "Three Wins", "Win 3 battles.", [{ metric: "battleWon", target: 3 }]),
  challenge(8, "Worldforge Strength", "Deal 150 damage using Worldforge Mystics.", [{ metric: "damageDealt", target: 150, order: "Worldforge" }]),
  challenge(9, "Special Success", "Successfully activate 2 Special Moves in a single battle.", [{ metric: "specialSucceeded", target: 2, singleBattle: true }]),
  winOrder(10, "Starwatch Victory", "Order of the Star"),
  challenge(11, "Survivor", "Win a battle with at least 2 Mystics still active.", [{ metric: "battleWon", target: 1, minSurvivors: 2 }]),
  challenge(12, "Basic Training", "Successfully land 10 Basic Attacks.", [{ metric: "basicLanded", target: 10 }]),
  winOrder(13, "Moonveil Squad", "Moonveil"),
  challenge(14, "Five Battles", "Complete 5 battles. Winning is not required.", [{ metric: "battleCompleted", target: 5 }]),
  challenge(15, "Precision", "Successfully land 5 attacks.", [{ metric: "attackLanded", target: 5 }]),
  winOrder(16, "Agespire Victory", "Agespire"),
  challenge(17, "Big Damage", "Deal at least 100 total damage during a single battle.", [{ metric: "damageDealt", target: 100, singleBattle: true }]),
  challenge(18, "Mystic Variety", "Use Mystics from at least 3 different Orders during battles today.", [{ metric: "distinctOrders", target: 3 }]),
  winOrder(19, "Stargate Squad", "Stargate"),
  challenge(20, "Special Training", "Attempt 5 Special Moves.", [{ metric: "specialAttempted", target: 5 }]),
  challenge(21, "Comeback", "Win after at least one of your Mystics has been defeated.", [{ metric: "battleWon", target: 1, requireAllyDefeated: true }]),
  winOrder(22, "First Spark Victory", "First Spark"),
  challenge(23, "Battle Veteran", "Win 2 battles using different team compositions.", [{ metric: "uniqueWinningLineups", target: 2 }]),
  challenge(24, "Defender", "Win while a surviving Mystic has at least 25% Power remaining.", [{ metric: "battleWon", target: 1, minSurvivorPowerPercent: 25 }]),
  winOrder(25, "Order of the Star", "Order of the Star"),
  challenge(26, "Quick Training", "Complete 3 battles.", [{ metric: "battleCompleted", target: 3 }]),
  challenge(27, "Sovereign Strength", "Deal 150 damage using Sovereign Order Mystics.", [{ metric: "damageDealt", target: 150, order: "Sovereign Order" }]),
  challenge(28, "Order Explorer", "Use Mystics from at least 5 different Orders across battles today.", [{ metric: "distinctOrders", target: 5 }]),
  challenge(29, "Winning Streak", "Win 2 battles in a row.", [{ metric: "winStreak", target: 2 }]),
  challenge(30, "Mystic Master", "Win 2 battles, deal 200 damage, and activate 2 Special Moves.", [
    { metric: "battleWon", target: 2 }, { metric: "damageDealt", target: 200 }, { metric: "specialSucceeded", target: 2 },
  ], 300, 250),
];

export const DAILY_ROTATION_EPOCH = "2026-09-01T00:00:00.000Z";
export const SEASON_XP_SOURCES = { battleComplete: 20, battleWin: 30, firstBattleOfDay: 50 } as const;
export const SEASON_ONE = { id: "season-01", number: 1, name: "Season 1", startsAt: "2026-09-01T00:00:00.000Z", endsAt: "2026-10-01T00:00:00.000Z" } as const;

export const SEASON_TIER_THRESHOLDS = Array.from({ length: 50 }, (_, index) => {
  if (index === 0) return 0;
  if (index <= 4) return index * 150;
  if (index <= 9) return 600 + (index - 4) * 180;
  if (index <= 19) return 1500 + (index - 9) * 250;
  if (index <= 29) return 4000 + (index - 19) * 300;
  if (index <= 39) return 7000 + (index - 29) * 350;
  return 10500 + (index - 39) * 450;
});

export type SeasonReward = {
  type: "coins" | "xpBoost" | "coinBoost" | "standardPack" | "mystic" | "illustrationRare" | "mysticPlaceholder" | "illustrationRarePlaceholder";
  amount?: number;
  definitionId?: string;
  artworkVariant?: string;
  placeholderId?: string;
  label: string;
};
const coins = (amount: number): SeasonReward => ({ type: "coins", amount, label: `${amount.toLocaleString()} Coins` });
const xpBoost = (): SeasonReward => ({ type: "xpBoost", label: "XP Boost" });
const coinBoost = (): SeasonReward => ({ type: "coinBoost", label: "Coin Boost" });
const pack = (): SeasonReward => ({ type: "standardPack", label: "Standard Pack" });
const mystic = (definitionId: string, label: string): SeasonReward => ({ type: "mystic", definitionId, label });
const rare = (definitionId: string, label: string, artworkVariant: string): SeasonReward => ({ type: "illustrationRare", definitionId, artworkVariant, label });
export const SEASON_ONE_REWARDS: SeasonReward[] = [
  coins(250), xpBoost(), pack(), coins(250), mystic("MM-030", "Tallus · Alpha Mystic"), coinBoost(), coins(300), pack(), xpBoost(), rare("MM-001", "Swift · Ascendant Art", "/cards/Mystics/illustration%20rares/season_01_ir_01.png"),
  coins(300), pack(), coinBoost(), coins(400), mystic("MM-050", "Astraleye · Alpha Mystic"), xpBoost(), pack(), coins(400), coinBoost(), rare("MM-002", "Duney · Ascendant Art", "/cards/Mystics/illustration%20rares/season_01_ir_02.png"),
  coins(500), pack(), xpBoost(), coins(500), mystic("MM-060", "Umbraxis · Alpha Mystic"), coinBoost(), pack(), coins(600), xpBoost(), mystic("MM-075", "Imperius · Alpha Mystic"),
  coins(600), pack(), coinBoost(), coins(700), mystic("MM-080", "Polaris · Alpha Mystic"), xpBoost(), pack(), coins(700), coinBoost(), rare("MM-003", "Leafo · Ascendant Art", "/cards/Mystics/illustration%20rares/season_01_ir_03.png"),
  coins(800), pack(), xpBoost(), coins(800), mystic("MM-091", "Briar King · Alpha Mystic"), coinBoost(), pack(), coins(1000), pack(), rare("MM-029", "Ironjaw · Season Finale Ascendant Art", "/cards/Mystics/illustration%20rares/season_01_ir_finale.png"),
];
