import { afterEach, expect, it, vi } from "vitest";
import { initialState } from "./client-state";

vi.mock("./supabase", () => ({ getSupabaseAccessToken: async () => "test-token" }));
afterEach(() => vi.unstubAllGlobals());

it("combines a battle save backlog into the latest snapshot before a claim, preserving activities", async () => {
  const { queueCloudGameState } = await import("./game-sync-client");
  let release!: (value: Response) => void;
  const fetchMock = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { release = resolve; }))
    .mockImplementation(async () => new Response("{}"));
  vi.stubGlobal("fetch", fetchMock);
  const state = structuredClone(initialState);
  const saves = [queueCloudGameState(state, "BATTLE_STARTED")];
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  for (let revision = 1; revision <= 40; revision++) {
    state.saveRevision = revision;
    saves.push(queueCloudGameState(state, revision % 2 ? "BASIC_ATTACK" : "AI_TURN"));
  }
  saves.push(queueCloudGameState(state, "PROGRESSION_SYNC"));
  release(new Response("{}"));
  await Promise.all(saves);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  const body = JSON.parse(fetchMock.mock.calls[1][1].body);
  expect(body.state.saveRevision).toBe(40);
  expect(body.precedingActivities).toHaveLength(40);
  expect(body.activity.type).toBe("PROGRESSION_SYNC");
});

it("preserves purchase snapshots and continues after a failed save", async () => {
  const { queueCloudGameState } = await import("./game-sync-client");
  let release!: (value: Response) => void;
  const fetchMock = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { release = resolve; }))
    .mockImplementation(async () => new Response("{}"));
  vi.stubGlobal("fetch", fetchMock);
  const state = structuredClone(initialState);
  const failed = queueCloudGameState(state, "SESSION_STARTED").catch(error => error);
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  state.activeOpeningId = "purchase-opening";
  const purchase = queueCloudGameState(state, "PACK_PURCHASED", { packId: "standard" });
  state.activeOpeningId = null;
  const flush = queueCloudGameState(state, "PROGRESSION_SYNC");
  release(new Response('{"error":"Save failed"}', { status: 500 }));
  expect(await failed).toBeInstanceOf(Error);
  await Promise.all([purchase, flush]);
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).state.activeOpeningId).toBe("purchase-opening");
  expect(JSON.parse(fetchMock.mock.calls[2][1].body).activity.type).toBe("PROGRESSION_SYNC");
});
