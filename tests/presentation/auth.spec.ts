import { expect, test } from "@playwright/test";

test("valid email signup submits and displays the confirmation instruction", async ({ page }) => {
  let submissions = 0;
  await page.route("**/auth/v1/signup*", async (route) => {
    submissions += 1;
    expect(route.request().postDataJSON()).toMatchObject({
      email: "signup-test@example.com",
      password: "test-password-123",
      data: { handler_name: "TestHandler" },
    });
    await route.fulfill({ json: { user: { id: "test-user", email: "signup-test@example.com", identities: [] }, session: null } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: /Create your account/ }).click();
  await page.getByLabel(/^Handler name/).fill("TestHandler");
  await page.getByLabel(/^Email/).fill("signup-test@example.com");
  await page.getByLabel(/^Password/).fill("test-password-123");
  await page.getByRole("button", { name: "ENTER MINI MYSTICS" }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText("Check your email to confirm");
  expect(submissions).toBe(1);
  await expect(page.getByRole("button", { name: "ENTER MINI MYSTICS" })).toBeEnabled();
});

test("invalid signup details show errors and server failures allow a retry", async ({ page }) => {
  let submissions = 0;
  await page.route("**/auth/v1/signup*", async (route) => {
    submissions += 1;
    await route.fulfill({ status: 422, json: { code: "weak_password", msg: "Choose a stronger password." } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: /Create your account/ }).click();
  await page.getByRole("button", { name: "ENTER MINI MYSTICS" }).click();
  await expect(page.getByText("Handler names must be 3 to 20 characters.")).toBeVisible();
  await expect(page.getByText("Enter a valid email address.")).toBeVisible();
  await expect(page.getByText("Password must contain at least 8 characters.")).toBeVisible();
  expect(submissions).toBe(0);
  await page.getByLabel(/^Handler name/).fill("TestHandler");
  await page.getByLabel(/^Email/).fill("signup-test@example.com");
  await page.getByLabel(/^Password/).fill("test-password-123");
  await page.getByRole("button", { name: "ENTER MINI MYSTICS" }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText("Choose a stronger password.");
  await expect(page.getByRole("button", { name: "ENTER MINI MYSTICS" })).toBeEnabled();
  expect(submissions).toBe(1);
});

