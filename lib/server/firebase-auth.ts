import { createRemoteJWKSet, jwtVerify } from "jose";

const FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "minimystics-eb9e2";
const FIREBASE_ISSUER = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
const FIREBASE_KEYS = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));

export type VerifiedFirebaseUser = {
  uid: string;
  email: string;
  name?: string;
};

export async function requireFirebaseUser(request: Request): Promise<VerifiedFirebaseUser> {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) throw new Error("UNAUTHORIZED");

  const { payload } = await jwtVerify(token, FIREBASE_KEYS, {
    algorithms: ["RS256"],
    audience: FIREBASE_PROJECT_ID,
    issuer: FIREBASE_ISSUER,
  });
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  if (!payload.sub || !email) throw new Error("UNAUTHORIZED");
  return { uid: payload.sub, email, name: typeof payload.name === "string" ? payload.name : undefined };
}
