import { existsSync, readdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";

const sourceDir = join(process.cwd(), "node_modules", ".prisma", "client");
const serverFunctionsDir = join(process.cwd(), ".open-next", "server-functions");

if (!existsSync(sourceDir) || !existsSync(serverFunctionsDir)) process.exit(0);

const wasmFiles = readdirSync(sourceDir).filter((name) => name.endsWith(".wasm"));

for (const functionName of readdirSync(serverFunctionsDir)) {
  const targetDir = join(serverFunctionsDir, functionName, "node_modules", ".prisma", "client");
  if (!existsSync(targetDir)) continue;
  for (const wasmFile of wasmFiles) {
    const target = join(targetDir, wasmFile);
    if (!existsSync(target)) {
      copyFileSync(join(sourceDir, wasmFile), target);
      console.log(`Copied ${wasmFile} into ${targetDir}`);
    }
  }
}
