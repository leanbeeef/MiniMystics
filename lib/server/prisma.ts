import { PrismaPg } from "@prisma/adapter-pg";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { PrismaClient } from "@prisma/client";

type HyperdriveBinding = { connectionString: string };

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaConnectionString?: string;
};

function databaseUrl() {
  let connectionString: string | undefined;
  try {
    const env = getCloudflareContext().env as CloudflareEnv & { HYPERDRIVE?: HyperdriveBinding };
    connectionString = env.HYPERDRIVE?.connectionString;
  } catch {
    // next dev and local scripts use DATABASE_URL instead of a Worker binding.
  }

  connectionString ??= process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Database persistence is not configured for this deployment.");
  const url = new URL(connectionString);
  if (url.hostname.endsWith(".pooler.supabase.com")) {
    url.searchParams.set("uselibpqcompat", "true");
  }
  return url.toString();
}

export function getPrisma() {
  const connectionString = databaseUrl();
  if (!globalForPrisma.prisma || globalForPrisma.prismaConnectionString !== connectionString) {
    const adapter = new PrismaPg({ connectionString, max: 5 });
    globalForPrisma.prisma = new PrismaClient({ adapter });
    globalForPrisma.prismaConnectionString = connectionString;
  }
  return globalForPrisma.prisma;
}
