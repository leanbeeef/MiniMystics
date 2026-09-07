import { cache } from "react";
import { PrismaPg } from "@prisma/adapter-pg";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { PrismaClient } from "@prisma/client";

type HyperdriveBinding = { connectionString: string };

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

export const getPrisma = cache(() => {
  const adapter = new PrismaPg({ connectionString: databaseUrl(), max: 1, maxUses: 1 });
  return new PrismaClient({ adapter });
});
