import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Supabase direct database hosts are IPv6-only on some projects. Allow deployments to use the
// official session pooler without duplicating the database password in another environment value.
if (process.env.DATABASE_URL && process.env.DATABASE_POOLER_HOST) {
  const url = new URL(process.env.DATABASE_URL);
  const projectRef = url.hostname.match(/^db\.([^.]+)\.supabase\.co$/)?.[1];
  if (projectRef) {
    url.hostname = process.env.DATABASE_POOLER_HOST;
    url.port = "5432";
    url.username = `postgres.${projectRef}`;
    url.searchParams.set("uselibpqcompat", "true");
    process.env.DATABASE_URL = url.toString();
  }
}

const steps = [
  [resolve(root, "node_modules/prisma/build/index.js"), "migrate", "deploy"],
  [resolve(root, "node_modules/tsx/dist/cli.mjs"), resolve(root, "prisma/seed.ts")],
];

for (const [entrypoint, ...args] of steps) {
  const result = spawnSync(process.execPath, [entrypoint, ...args], {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
