import { expect, test, type Page } from "@playwright/test";
import { grantStandardPack, initialState, type PlayerState } from "../../lib/client-state";
import { defaultSettings, serializeSettings } from "../../lib/settings";

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
    state.progression.seasons["season-01"] = { seasonId: "season-01", seasonXp: 15000, currentTier: 50, claimedTiers: [], updatedAt: new Date().toISOString() };
  });
  await page.goto("/season-pass");
  await expect(page.getByRole("list", { name: "Season reward tiers" }).getByRole("listitem")).toHaveCount(50);
  await expect(page.locator(".season-tier.milestone")).toHaveCount(5);
  const swiftReward = page.getByRole("listitem").filter({ hasText: "TIER 10" });
  await expect(swiftReward).toContainText("Swift · Illustration Rare");
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
  await page.route("**/api/progression/daily-pack", (route) => route.fulfill({ json: { state: claimed } }));
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
