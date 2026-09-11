import type { PlayerState } from "./client-state";

export type AdminBalanceTotals = { coins: number; premium: number };

// Snapshots remember the ledger totals already included in their balances. Applying
// only the difference preserves offline earnings/spending and makes retries safe.
export function reconcileAdminBalance(state: PlayerState, totals: AdminBalanceTotals) {
  const previous = state.adminBalanceTotals ?? { coins: 0, premium: 0 };
  state.coins = Math.max(0, state.coins + totals.coins - previous.coins);
  state.premium = Math.max(0, state.premium + totals.premium - previous.premium);
  state.adminBalanceTotals = { ...totals };
}
