import { access, copyFile, cp, mkdir } from 'node:fs/promises';
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

if (await exists(source)) {
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
  console.log('Synced the shared Mini Mystics Prisma schema.');
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
