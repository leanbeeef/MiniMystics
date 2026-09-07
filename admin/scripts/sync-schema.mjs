import { access, cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(here, '../../prisma/schema.prisma');
const destination = resolve(here, '../prisma/schema.prisma');
const migrationsSource = resolve(here, '../../prisma/migrations');
const migrationsDestination = resolve(here, '../prisma/migrations');

const exists = async (path) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

// The admin app runs as a real Node.js process in a Cloudflare Container (not a Workers
// isolate), so — unlike the main app — it can run Prisma's classic query engine. It must NOT
// share the main app's `engineType = "client"` / `previewFeatures = ["queryCompiler",
// "driverAdapters"]` generator: that mode ships a stripped-down static DMMF (missing `isId` and
// other field flags) that @adminjs/prisma depends on to find each model's primary key — using it
// here makes every single AdminJS resource fail with "does not have an id property". Swap the
// generator block back to the classic engine after syncing the shared schema/models.
const classicGeneratorBlock = `generator client {
  provider = "prisma-client-js"
}`;

const useClassicEngine = (schema) => schema.replace(/generator client \{[^}]*\}/, classicGeneratorBlock);

if (await exists(source)) {
  await mkdir(dirname(destination), { recursive: true });
  const shared = await readFile(source, 'utf8');
  await writeFile(destination, useClassicEngine(shared));
  console.log('Synced the shared Mini Mystics Prisma schema (classic engine for AdminJS compatibility).');
} else if (!(await exists(destination))) {
  throw new Error('The shared Prisma schema and bundled admin schema are both missing.');
} else {
  console.log('Using the bundled Mini Mystics Prisma schema.');
}

if (await exists(migrationsSource)) {
  await mkdir(migrationsDestination, { recursive: true });
  await cp(migrationsSource, migrationsDestination, { recursive: true, force: true });
  console.log('Synced the shared Mini Mystics database migrations.');
} else if (!(await exists(migrationsDestination))) {
  throw new Error('The shared Prisma migrations and bundled admin migrations are both missing.');
} else {
  console.log('Using the bundled Mini Mystics database migrations.');
}
