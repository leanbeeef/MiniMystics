import { beforeEach, expect, it, vi } from "vitest";
import { initialState } from "./client-state";

const mocks = vi.hoisted(() => ({ findFirst: vi.fn() }));
vi.mock("@/lib/server/supabase-auth", () => ({
  requireSupabaseUser: vi.fn().mockResolvedValue({ uid: "test-user", email: "test@example.com" }),
}));
vi.mock("@/lib/server/prisma", () => ({ getPrisma: () => ({ playerGameState: { findFirst: mocks.findFirst } }) }));
vi.mock("@/lib/server/progression-config", () => ({ getRuntimeProgressionConfig: vi.fn().mockResolvedValue(null) }));

import { GET } from "@/app/api/game-state/route";

beforeEach(() => vi.clearAllMocks());

it("loads the admin adjustment ledger into the game snapshot on every login without duplicating grants", async () => {
  const state = structuredClone(initialState);
  state.coins = 200;
  const save = {
    state, version: 1, updatedAt: new Date(),
    profile: {
      adminAdjustments: [{ currency: "COINS", amount: 100_000 }, { currency: "PREMIUM", amount: 20 }],
      lastDailyPackClaimAt: null, campaign: [], seasonProgress: [], seasonRewardClaims: [], challengeAssignments: [],
    },
  };
  mocks.findFirst.mockResolvedValue(save);
  const response = await GET(new Request("http://localhost/api/game-state"));
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.state.coins).toBe(100_200);
  expect(body.state.premium).toBe(20);
  expect(save.state.coins).toBe(200);
  mocks.findFirst.mockResolvedValue({ ...save, state: body.state });
  const repeat = await GET(new Request("http://localhost/api/game-state"));
  expect((await repeat.json()).state.coins).toBe(100_200);
  expect(mocks.findFirst.mock.calls[0][0].include.profile.select.adminAdjustments).toBeTruthy();
});
