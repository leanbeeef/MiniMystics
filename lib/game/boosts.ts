export const BOOST_MATCHES = { Wild: 2, Hunter: 3, Predator: 5, Prime: 7, Alpha: 10, Apex: 15 } as const;

export function stackBoost(current: { type: "xp" | "coins"; matches: number } | null, next: { type: "xp" | "coins"; matches: number }) {
  if (!current) return { ...next, multiplier: 2 as const };
  if (current.type !== next.type) throw new Error("Boost categories must be stored separately");
  return { type: current.type, matches: current.matches + next.matches, multiplier: 2 as const };
}
