import { expect, test, type Page } from "@playwright/test";
import { grantStandardPack, initialState, type PlayerState } from "../../lib/client-state";
import { defaultSettings, serializeSettings } from "../../lib/settings";
import { challengeForDate, claimDailyChallenge, claimSeasonTier, utcDateKey } from "../../lib/progression/state";

const email = "progression@example.test";

async function progressionFixture(page: Page, prepare?: (state: PlayerState) => void) {
  const state = structuredClone(initialState);
  state.account = { email, username: "Progression Test" };
  state.openings = [];
  state.activeOpeningId = null;
  prepare?.(state);
  const settings = defaultSettings();
  settings.gameplay.animationMode = "minimal";
  const user = {
    id: "00000000-0000-4000-8000-000000000002",
    email,
    aud: "authenticated",
    role: "authenticated",
    app_metadata: {},
    user_metadata: { display_name: "Progression Test" },
    created_at: "2026-09-01T00:00:00Z",
  };
  const payload = Buffer.from(JSON.stringify({ sub: user.id, exp: 4102444800, role: "authenticated" })).toString("base64url");
  const session = { access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.fixture`, refresh_token: "fixture", expires_at: 4102444800, expires_in: 3600, token_type: "bearer", user };
  await page.route("**/api/**", (route) => route.fulfill({
    json: route.request().url().includes("/profile")
      ? { id: user.id, handlerName: "Progression Test", avatarPath: "", tagline: "", region: "", allegiance: "" }
      : route.request().method() === "GET" ? { state } : {},
  }));
  await page.route("https://presentation-test.supabase.co/**", (route) => route.fulfill({ json: user }));
  await page.addInitScript(({ state: saved, serializedSettings, authSession, accountEmail }) => {
    localStorage.setItem("mini-mystics.accounts.v1", JSON.stringify({ [accountEmail]: { state: saved } }));
    localStorage.setItem("sb-presentation-test-auth-token", JSON.stringify(authSession));
    localStorage.setItem("mini-mystics.settings", serializedSettings);
  }, { state, serializedSettings: serializeSettings(settings, true), authSession: session, accountEmail: email });
  return state;
}

test("dashboard presents the Daily Pack, Daily Challenge, and Season Pass", async ({ page }) => {
  await progressionFixture(page);
  await page.goto("/game");
  const dailyDialog = page.getByRole("dialog", { name: "Your Daily Pack is ready" });
  await expect(dailyDialog).toBeVisible();
  await dailyDialog.getByRole("button", { name: "Later" }).click();
  await expect(page.locator(".retention-grid .daily-pack-card")).toContainText("Ready");
  await expect(page.locator(".retention-grid .daily-challenge-card")).toContainText("Next Challenge:");
  await expect(page.locator(".retention-grid .season-summary")).toContainText("Tier 1");
});

test("Season Pass renders all fifty tiers and emphasizes the finale", async ({ page }) => {
  await progressionFixture(page, (state) => {
    state.progression.seasons["season-01"] = { seasonId: "season-01", seasonXp: 15000, currentTier: 50, claimedTiers: [1, 2], updatedAt: new Date().toISOString() };
  });
  await page.goto("/season-pass");
  const rewardList = page.getByRole("list", { name: "Season reward tiers" });
  await expect(rewardList.getByRole("listitem")).toHaveCount(50);
  await expect(page.locator(".season-tier.milestone")).toHaveCount(5);
  const coinReward = rewardList.getByRole("listitem").nth(0);
  const xpReward = rewardList.getByRole("listitem").nth(1);
  const packReward = rewardList.getByRole("listitem").nth(2);
  await expect(coinReward.locator("img")).toHaveAttribute("src", /art\/rewards\/coins\.webp$/);
  await expect(coinReward.locator(".season-reward-amount")).toHaveText("+250");
  await expect(coinReward.locator(".season-claimed-stamp")).toHaveText("CLAIMED");
  await expect(xpReward.locator("img")).toHaveAttribute("src", /art\/rewards\/xp-boost\.webp$/);
  await expect(packReward.locator("img")).toHaveAttribute("src", /art\/packs\/standard\.webp$/);
  const swiftReward = rewardList.getByRole("listitem").nth(9);
  await expect(swiftReward).toContainText("Swift · Ascendant Art");
  await expect(swiftReward.locator("img")).toHaveAttribute("src", /season_01_ir_01\.webp$/);
  await expect(page.locator(".season-tier.finale")).toContainText("Season Finale");
  await expect(page.locator(".season-tier.finale img")).toHaveAttribute("src", /season_01_ir_finale\.webp$/);
  await expect(page.locator(".season-tier.finale")).toContainText("15,000 XP");
});

test("Inventory always displays all ten Essence balances", async ({ page }) => {
  await progressionFixture(page, (state) => { state.essence.Starwatch = 120; });
  await page.goto("/inventory");
  await expect(page.locator(".essence-grid > div")).toHaveCount(10);
  await expect(page.locator(".essence-panel")).toContainText("Order of the Star");
  await expect(page.locator(".essence-panel")).toContainText("First Spark");
  await expect(page.locator(".essence-panel")).toContainText("Total Essence: 120");
});

test("Daily Pack uses the existing opening flow and returns to the dashboard", async ({ page }) => {
  const initial = await progressionFixture(page);
  const claimed = structuredClone(initial);
  grantStandardPack(claimed, "daily", "Daily Standard Pack");
  claimed.progression.lastDailyPackClaimAt = new Date().toISOString();
  await page.route("**/api/progression/daily-pack", (route) => route.fulfill({ json: { state: claimed, granted: true } }));
  await page.goto("/game");
  await page.getByRole("dialog", { name: "Your Daily Pack is ready" }).getByRole("button", { name: "Open Pack" }).click();
  await expect(page).toHaveURL(/\/open$/);
  await page.getByRole("button", { name: "OPEN PACK", exact: true }).click();
  await page.getByRole("button", { name: "Reveal all" }).click();
  await expect(page.getByText("Pack complete", { exact: true })).toBeVisible({ timeout: 15000 });
  await page.getByRole("link", { name: /Return to dashboard/ }).click();
  await expect(page).toHaveURL(/\/game$/);
  await expect(page.getByRole("dialog", { name: "Your Daily Pack is ready" })).toHaveCount(0);
});

test("an already claimed Season reward is reconciled without showing an error", async ({ page }) => {
  const initial = await progressionFixture(page, (state) => {
    state.progression.seasons["season-01"] = { seasonId: "season-01", seasonXp: 0, currentTier: 1, claimedTiers: [], updatedAt: new Date().toISOString() };
  });
  const reconciled = structuredClone(initial);
  reconciled.progression.seasons["season-01"].claimedTiers = [1];
  await page.route("**/api/progression/claim", (route) => route.fulfill({ json: { state: reconciled, alreadyClaimed: true } }));

  await page.goto("/season-pass");
  const tierOne = page.getByRole("list", { name: "Season reward tiers" }).getByRole("listitem").filter({ hasText: "TIER 1" });
  await tierOne.getByRole("button", { name: "Claim" }).click();

  await expect(tierOne.locator(".season-claimed-stamp")).toHaveText("CLAIMED");
  await expect(tierOne.getByRole("button", { name: "Claim" })).toHaveCount(0);
});

test("Season claims display immediately, award coins, and allow retry after a failure", async ({ page }) => {
  const initial = await progressionFixture(page);
  const claimed = structuredClone(initial);
  claimed.coins += 250;
  claimed.progression.seasons["season-01"] = { seasonId: "season-01", seasonXp: 0, currentTier: 1, claimedTiers: [1], updatedAt: new Date().toISOString() };
  let release!: () => void;
  const responseReady = new Promise<void>(resolve => { release = resolve; });
  let attempts = 0;
  await page.route("**/api/progression/claim", async route => {
    attempts += 1;
    if (attempts === 1) {
      await responseReady;
      await route.fulfill({ status: 503, json: { error: "Please try claiming again." } });
    } else await route.fulfill({ json: { state: claimed } });
  });
  await page.goto("/season-pass");
  const tier = page.getByRole("list", { name: "Season reward tiers" }).getByRole("listitem").first();
  await tier.getByRole("button", { name: "Claim", exact: true }).click();
  await expect(tier.locator(".season-claimed-stamp")).toHaveText("CLAIMED");
  await expect(tier.getByRole("button", { name: "Claim", exact: true })).toHaveCount(0);
  release();
  await expect(page.locator(".toast-error")).toHaveText("Please try claiming again.");
  await tier.getByRole("button", { name: "Claim", exact: true }).click();
  await expect(tier.locator(".season-claimed-stamp")).toHaveText("CLAIMED");
  await expect(page.locator(".resource-counter strong")).toHaveText(claimed.coins.toLocaleString());
  await expect(page.locator(".toast-error")).toHaveCount(0);
});

test("multiple Season tiers display claimed before a slow save and survive navigation", async ({ page }) => {
  const initial = await progressionFixture(page, state => {
    state.progression.seasons["season-01"] = { seasonId: "season-01", seasonXp: 150, currentTier: 2, claimedTiers: [], updatedAt: new Date().toISOString() };
  });
  let release!: () => void;
  const saveReady = new Promise<void>(resolve => { release = resolve; });
  const saves: PlayerState[] = [];
  const claims: number[] = [];
  await page.route("**/api/game-state", async route => {
    if (route.request().method() === "GET") return route.fulfill({ json: { state: initial } });
    const body = route.request().postDataJSON();
    if (body.activity.type === "PROGRESSION_SYNC") {
      saves.push(body.state);
      await saveReady;
    }
    await route.fulfill({ json: {} });
  });
  const confirmed = structuredClone(initial);
  await page.route("**/api/progression/claim", async route => {
    const { tier } = route.request().postDataJSON();
    claims.push(tier);
    claimSeasonTier(confirmed, tier, () => undefined);
    await route.fulfill({ json: { state: confirmed } });
  });
  await page.goto("/season-pass");
  const tiers = page.getByRole("list", { name: "Season reward tiers" }).getByRole("listitem");
  await tiers.nth(0).getByRole("button", { name: "Claim", exact: true }).click();
  await tiers.nth(1).getByRole("button", { name: "Claim", exact: true }).click();
  await expect(page.locator(".season-claimed-stamp")).toHaveCount(2);
  expect(claims).toEqual([]);
  await page.getByRole("link", { name: "Daily Challenge", exact: true }).click();
  await page.getByRole("link", { name: "Season Pass", exact: true }).click();
  await expect(page.locator(".season-claimed-stamp")).toHaveCount(2);
  release();
  await expect.poll(() => claims).toEqual([1, 2]);
  await expect(page.locator('.season-claimed-stamp[title="Saving reward..."]')).toHaveCount(0);
  expect(saves[0].progression.seasons["season-01"].claimedTiers).toEqual([]);
  expect(saves[1].progression.seasons["season-01"].claimedTiers).toEqual([1]);
  await expect(page.locator(".resource-counter strong")).toHaveText(confirmed.coins.toLocaleString());
});

test("Daily Challenge displays claimed before saving, rolls back on save failure, and retries", async ({ page }) => {
  const now = new Date();
  const date = utcDateKey(now);
  const challenge = challengeForDate(now);
  const initial = await progressionFixture(page, state => {
    state.progression.lastDailyPackClaimAt = now.toISOString();
    state.progression.dailyChallenges[date] = {
      challengeId: challenge.id, challengeDate: date,
      values: Object.fromEntries(challenge.requirements.map(item => [item.metric, item.target])),
      sets: {}, battleValues: {}, completed: true, rewardClaimed: false,
    };
  });
  let release!: () => void;
  const saveReady = new Promise<void>(resolve => { release = resolve; });
  let attempts = 0;
  let claims = 0;
  await page.route("**/api/game-state", async route => {
    if (route.request().method() === "GET") return route.fulfill({ json: { state: initial } });
    const body = route.request().postDataJSON();
    if (body.activity.type === "PROGRESSION_SYNC") {
      expect(body.state.progression.dailyChallenges[date].rewardClaimed).toBe(false);
      attempts += 1;
      if (attempts === 1) {
        await saveReady;
        return route.fulfill({ status: 503, json: { error: "Could not save progress. Try again." } });
      }
    }
    await route.fulfill({ json: {} });
  });
  const confirmed = structuredClone(initial);
  claimDailyChallenge(confirmed, now);
  await page.route("**/api/progression/claim", route => {
    claims += 1;
    return route.fulfill({ json: { state: confirmed } });
  });
  await page.goto("/daily-challenge");
  await page.getByRole("button", { name: "Claim reward", exact: true }).click();
  await expect(page.locator(".claimed-label")).toHaveText("Claimed");
  expect(claims).toBe(0);
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(page.locator(".daily-challenge-card .claimed-label")).toHaveText("Claimed");
  release();
  await expect(page.locator(".toast-error")).toHaveText("Could not save progress. Try again.");
  await page.getByRole("button", { name: "Claim reward", exact: true }).click();
  await expect(page.locator(".claimed-label")).toHaveText("Claimed");
  await expect(page.locator(".resource-counter strong")).toHaveText(confirmed.coins.toLocaleString());
  expect(claims).toBe(1);
  await expect(page.locator(".toast-error")).toHaveCount(0);
});

test("a stale Daily Pack prompt closes when the server says it was already claimed", async ({ page }) => {
  const initial = await progressionFixture(page);
  const reconciled = structuredClone(initial);
  reconciled.progression.lastDailyPackClaimAt = new Date().toISOString();
  await page.route("**/api/progression/daily-pack", (route) => route.fulfill({ json: { state: reconciled, granted: false } }));

  await page.goto("/game");
  await page.getByRole("dialog", { name: "Your Daily Pack is ready" }).getByRole("button", { name: "Open Pack" }).click();

  await expect(page).toHaveURL(/\/game$/);
  await expect(page.getByRole("dialog", { name: "Your Daily Pack is ready" })).toHaveCount(0);
  await expect(page.locator(".retention-grid .daily-pack-card")).toContainText("Next Pack");
});
