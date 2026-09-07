import { Database, Resource } from '@adminjs/prisma';
import { PrismaClient } from '@prisma/client';
import AdminJS from 'adminjs';

const connectionString = () => {
  const url = new URL(process.env.DATABASE_URL as string);
  if (url.hostname.endsWith('.pooler.supabase.com') || url.hostname.endsWith('.supabase.co')) {
    url.searchParams.set('uselibpqcompat', 'true');
  }
  return url.toString();
};

// Classic engine (see scripts/sync-schema.mjs) talks to Postgres directly — no driver adapter.
export const prisma = new PrismaClient({ datasourceUrl: connectionString() });

AdminJS.registerAdapter({ Database, Resource });

const initialize = async () => {
  await prisma.$connect();
  return { prisma };
};

export default initialize;
