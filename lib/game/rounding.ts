/** Mini Mystics rounding rule: .5 and above rounds up, below .5 rounds down. Single source of truth for every stat/damage/heal/buff calculation. */
export const roundHalfUp = (value: number) => Math.floor(value + 0.5);
