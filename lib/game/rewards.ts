export const REWARD_TUNING = {
  sizeBase: { 3: { xp: 40, coins: 32 }, 5: { xp: 65, coins: 52 }, 8: { xp: 100, coins: 80 } },
  winMultiplier: 1.45,
  lossMultiplier: 0.62,
  koXp: 7,
  koCoins: 4,
  survivorXp: 4,
  powerRatioBonus: 0.25,
};

export function calculateRewards(input: { size: 3 | 5 | 8; won: boolean; defeated: number; survivors: number; survivingPower: number; maxPower: number }) {
  const base = REWARD_TUNING.sizeBase[input.size];
  const resultRatio = input.maxPower ? input.survivingPower / input.maxPower : 0;
  const closeness = input.won ? resultRatio : Math.min(1, input.defeated / input.size);
  const multiplier = input.won ? REWARD_TUNING.winMultiplier : REWARD_TUNING.lossMultiplier + closeness * REWARD_TUNING.powerRatioBonus;
  return {
    xp: Math.round(base.xp * multiplier + input.defeated * REWARD_TUNING.koXp + input.survivors * REWARD_TUNING.survivorXp),
    coins: Math.round(base.coins * multiplier + input.defeated * REWARD_TUNING.koCoins),
  };
}

export const xpForLevel = (level: number) => 100 + (level - 1) * 45 + Math.floor((level - 1) ** 1.35 * 12);
