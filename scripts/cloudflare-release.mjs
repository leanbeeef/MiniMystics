import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const action = process.argv[2] ?? "deploy";
if (!new Set(["deploy", "upload"]).has(action)) {
  console.error(`Unsupported Cloudflare release action: ${action}`);
  process.exit(1);
}

const bindingName = "HYPERDRIVE";
const hyperdriveVariable = `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_${bindingName}`;
const connectionString = process.env[hyperdriveVariable] ?? process.env.DATABASE_URL;
if (!connectionString) {
  console.error(`DATABASE_URL or ${hyperdriveVariable} must be available to the Cloudflare release command.`);
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const cli = resolve(here, "../node_modules/@opennextjs/cloudflare/dist/cli/index.js");
const result = spawnSync(process.execPath, [cli, action], {
  cwd: resolve(here, ".."),
  env: { ...process.env, [hyperdriveVariable]: connectionString },
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
