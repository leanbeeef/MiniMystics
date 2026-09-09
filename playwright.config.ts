import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/presentation", timeout: 45000, workers: 1,
  use: { baseURL: "http://127.0.0.1:3100", channel: "chrome", headless: true, screenshot: "only-on-failure" },
  webServer: { command: "npx next dev --hostname 127.0.0.1 --port 3100", url: "http://127.0.0.1:3100/settings", env: { NEXT_BUILD_DIR: ".next-presentation", NEXT_PUBLIC_SUPABASE_URL: "https://presentation-test.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-only-public-key" }, reuseExistingServer: !process.env.CI, timeout: 120000 },
});
