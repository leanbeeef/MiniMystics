import { createClient } from "@supabase/supabase-js";

let verifier: ReturnType<typeof createClient> | undefined;

export type VerifiedSupabaseUser = {
  uid: string;
  email: string;
  name?: string;
  emailVerified: boolean;
  accounts: Array<{ provider: "CREDENTIALS" | "GOOGLE"; providerAccountId: string }>;
};

function serverConfiguration() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey) throw new Error("AUTH_CONFIGURATION_MISSING");
  return { url, publishableKey };
}

export async function requireSupabaseUser(request: Request): Promise<VerifiedSupabaseUser> {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) throw new Error("UNAUTHORIZED");

  const { url, publishableKey } = serverConfiguration();
  verifier ??= createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const { data, error } = await verifier.auth.getClaims(token);
  const claims = data?.claims;
  const email = typeof claims?.email === "string" ? claims.email.trim().toLowerCase() : "";
  if (error || !claims?.sub || !email) throw new Error("UNAUTHORIZED");

  const rawProviders = Array.isArray(claims.app_metadata?.providers)
    ? claims.app_metadata.providers
    : [claims.app_metadata?.provider ?? "email"];
  const accounts: VerifiedSupabaseUser["accounts"] = [];
  for (const value of rawProviders) {
    if (value === "google") accounts.push({ provider: "GOOGLE", providerAccountId: claims.sub });
    if (value === "email") accounts.push({ provider: "CREDENTIALS", providerAccountId: claims.sub });
  }
  const metadataName = claims.user_metadata?.display_name ?? claims.user_metadata?.full_name ?? claims.user_metadata?.name;
  return {
    uid: claims.sub,
    email,
    name: typeof metadataName === "string" ? metadataName : undefined,
    emailVerified: true,
    accounts,
  };
}
