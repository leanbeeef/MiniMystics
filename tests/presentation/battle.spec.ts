import { expect, test, type Page } from "@playwright/test";
import { ALL_CAMPAIGN_STAGES, buyPack, catalog, createBattle, initialState, type PlayerState } from "../../lib/client-state";
import { defaultSettings, serializeSettings } from "../../lib/settings";
const email = "presentation@example.test";
async function fixture(page: Page, mode: "minimal" | "standard" | "cinematic" = "cinematic") {
  const state = structuredClone(initialState);
  state.account = { email, username: "Presentation Test" }; state.coins = 10000;
  const definition = catalog.mystics.find((card) => card.moves.some((move) => move.targetType === "enemy" && !move.needsReview && move.requiredRoll > 1))!;
  state.ownedCards = Array.from({ length: 3 }, (_, index) => ({ id: `fixture-${index}`, definitionId: definition.id, acquiredAt: "", level: 10 }));
  buyPack(state, "standard");
  createBattle(state, ALL_CAMPAIGN_STAGES.find((stage) => stage.size === 3)!.id, { mysticIds: state.ownedCards.slice(0, 3).map((card) => card.id) });
  state.battle!.currentTurn = "player";
  // The current catalog has no Apex entries; exercise the reserved presentation tier in this isolated fixture.
  state.battle!.player.mystics[0].rarity = "Apex";
  state.battle!.ai.mystics[0].currentPower = 1;
  const settings = defaultSettings(); settings.gameplay.animationMode = mode; settings.gameplay.autoAdvance = false;
  const user = { id: "00000000-0000-4000-8000-000000000001", email, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: { display_name: "Presentation Test" }, created_at: "2026-01-01T00:00:00Z" };
  const payload = Buffer.from(JSON.stringify({ sub: user.id, exp: 4102444800, role: "authenticated" })).toString("base64url");
  const session = { access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.fixture`, refresh_token: "fixture", expires_at: 4102444800, expires_in: 3600, token_type: "bearer", user };
  await page.route("**/api/**", (route) => route.fulfill({ json: route.request().url().includes("/profile") ? { id: user.id, handlerName: "Presentation Test", avatarPath: "", tagline: "", region: "", allegiance: "" } : route.request().method() === "GET" ? { state } : {} }));
  await page.route("https://presentation-test.supabase.co/**", (route) => route.fulfill({ json: user }));
  await page.addInitScript(({ state, settings, session, email }) => {
    localStorage.setItem("mini-mystics.accounts.v1", JSON.stringify({ [email]: { state } }));
    localStorage.setItem("sb-presentation-test-auth-token", JSON.stringify(session));
    localStorage.setItem("mini-mystics.settings", settings);
    Math.random = () => .01;
  }, { state, settings: serializeSettings(settings, true), session, email });
  return state;
}
const savedState = (page: Page) => page.evaluate((email) => JSON.parse(localStorage.getItem("mini-mystics.accounts.v1")!)[email].state as PlayerState, email);
test("commits damage before presentation, shows defeat, and waits for Continue", async ({ page }, testInfo) => {
  const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
  const state = await fixture(page);
  await page.goto("/battle");
  await page.getByRole("button", { name: "Continue battle" }).click();
  await page.getByRole("button", { name: /Basic Attack/ }).click();
  await page.locator(`[data-vfx-id="${state.battle!.ai.mystics[0].instanceId}"]`).click();
  const committed = await savedState(page);
  expect(committed.battle!.ai.mystics[0].defeated).toBe(true);
  expect(committed.battle!.currentTurn).toBe("ai");
  await expect(page.locator(".combat-text-defeat")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("battle-impact.png") });
  await page.getByRole("button", { name: "Continue battle" }).click();
  await expect(page.getByRole("button", { name: /Basic Attack/ })).toBeEnabled();
  expect((await savedState(page)).battle!.currentTurn).toBe("player");
  await page.setViewportSize({ width: 844, height: 390 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Minimize battle log", exact: true }).click();
  const powerBarsFit = await page.locator(".battle-side-player").evaluate((row) => {
    const bounds = row.getBoundingClientRect();
    return [...row.querySelectorAll(".battle-power-bar")].every((bar) => { const box = bar.getBoundingClientRect(); return box.top >= bounds.top && box.bottom <= bounds.bottom; });
  });
  expect(powerBarsFit).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("battle-landscape.png") });
  expect(errors).toEqual([]);
});
test("failed Apex Special has no success effect or power loss", async ({ page }) => {
  const state = await fixture(page, "standard");
  await page.goto("/battle"); await page.getByRole("button", { name: "Continue battle" }).click();
  const move = state.battle!.player.mystics[0].moves.find((move) => move.targetType === "enemy" && !move.needsReview && move.requiredRoll > 1)!;
  await page.locator(".battle-action-card.special").filter({ has: page.getByText(move.name, { exact: true }) }).click();
  await page.locator(`[data-vfx-id="${state.battle!.ai.mystics[1].instanceId}"]`).click();
  const dice = page.getByRole("dialog", { name: "Special Move die roll" });
  await expect(dice.locator(".battle-die-stage")).toHaveClass(/is-rolling/);
  expect(await dice.locator(".battle-die").evaluate((node) => node.getAnimations().some((animation) => animation.playState === "running"))).toBe(true);
  const duringRoll = await savedState(page);
  expect(duringRoll.battle!.lastRoll).toBe(1);
  expect(duringRoll.battle!.currentTurn).toBe("ai");
  await page.waitForFunction(() => document.querySelector(".battle-dice-tray.holding")?.textContent?.includes("Rolled 1"), undefined, { polling: "raf" });
  await expect(dice.getByText("FAILED", { exact: true })).toBeVisible();
  await expect(page.locator(".special-announcement")).toHaveCount(0);
  const resultVisibleMs = await page.evaluate(() => new Promise<number>((resolve) => {
    const start = performance.now();
    const check = () => document.querySelector(".battle-dice-tray.holding") ? requestAnimationFrame(check) : resolve(performance.now() - start);
    requestAnimationFrame(check);
  }));
  expect(resultVisibleMs).toBeGreaterThanOrEqual(1000);
  await expect(dice).toHaveCount(0);
  await expect(page.locator(".special-announcement")).toContainText(move.name);
  await expect(page.locator(".combat-text-failed")).toBeVisible();
  const after = await savedState(page);
  expect(after.battle!.ai.mystics[1].currentPower).toBe(state.battle!.ai.mystics[1].currentPower);
  expect(after.battle!.currentTurn).toBe("ai");
  expect(after.battle!.events.some((event) => event.data?.success === false)).toBe(true);
});
test("self-targeted Specials show the same committed die roll and success result", async ({ page }) => {
  const state = await fixture(page, "standard");
  await page.goto("/battle"); await page.getByRole("button", { name: "Continue battle" }).click();
  await page.evaluate(() => { Math.random = () => .99; });
  const move = state.battle!.player.mystics[0].moves.find((move) => move.targetType === "self" && !move.needsReview)!;
  await page.locator(".battle-action-card.special").filter({ has: page.getByText(move.name, { exact: true }) }).click();
  const dice = page.getByRole("dialog", { name: "Special Move die roll" });
  await expect(dice.locator(".battle-die-stage")).toHaveClass(/is-rolling/);
  await page.waitForFunction(() => document.querySelector(".battle-dice-tray.holding")?.textContent?.includes("Rolled 8"), undefined, { polling: "raf" });
  await expect(dice.getByText("SUCCESS", { exact: true })).toBeVisible();
  await expect(dice).toHaveCount(0);
  const after = await savedState(page);
  expect(after.battle!.lastRoll).toBe(8);
  expect(after.battle!.events.filter((event) => event.type === "roll")).toHaveLength(1);
  await expect(page.getByRole("button", { name: "Continue battle" })).toBeVisible();
});
test("pack reveals remain functional in Minimal mode", async ({ page }) => {
  const state = await fixture(page, "minimal");
  await page.goto("/open");
  await page.getByRole("button", { name: "Reveal all" }).click();
  await expect(page.getByText("Pack complete", { exact: true })).toBeVisible({ timeout: 15000 });
  const after = await savedState(page);
  expect(after.openings[0].cards.every((card) => card.revealed)).toBe(true);
  expect(after.ownedCards).toEqual(state.ownedCards);
});
test("successful Apex Special presents applied buffs and can be reduced immediately", async ({ page }) => {
  const state = await fixture(page);
  await page.goto("/battle"); await page.getByRole("button", { name: "Continue battle" }).click();
  await page.evaluate(() => { Math.random = () => .99; });
  const move = state.battle!.player.mystics[0].moves.find((move) => move.targetType === "enemy" && !move.needsReview)!;
  await page.locator(".battle-action-card.special").filter({ has: page.getByText(move.name, { exact: true }) }).click();
  await page.locator(`[data-vfx-id="${state.battle!.ai.mystics[1].instanceId}"]`).click();
  await expect(page.locator(".apex-sequence")).toBeVisible();
  await expect(page.locator(".combat-text-buff")).toBeVisible();
  const committed = await savedState(page);
  expect(committed.battle!.events.some((event) => event.data?.success === true)).toBe(true);
  // Simulate the supported cross-tab settings update during the sequence.
  await page.evaluate(() => {
    const key = "mini-mystics.settings"; const saved = JSON.parse(localStorage.getItem(key)!);
    saved.settings.visual.reducedMotion = true; saved.motionExplicit = true;
    const newValue = JSON.stringify(saved); localStorage.setItem(key, newValue);
    dispatchEvent(new StorageEvent("storage", { key, newValue }));
  });
  await expect(page.locator(".apex-sequence")).toHaveCount(0);
  await expect(page.locator(".mm-battle")).toHaveAttribute("aria-busy", "false");
  expect((await savedState(page)).battle).toEqual(committed.battle);
});
