import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { accountSyncKey } from "./account-policy";
import { getAccountRegistry, registryConfigured } from "./account-registry";

export function loginConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
    registryConfigured(),
  );
}
export type Identity = { uid: string; email: string; syncKey: string };

export async function verifyIdentity(request: Request): Promise<Identity | Response> {
  if (!loginConfigured())
    return Response.json(
      { error: "Login is not configured. Contact the workspace owner." },
      { status: 503 },
    );
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer "))
    return Response.json({ error: "Sign in to access your private workspace." }, { status: 401 });
  try {
    const app =
      getApps().find((entry) => entry.name === "throughline-auth") ??
      initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID }, "throughline-auth");
    const token = await getAuth(app).verifyIdToken(header.slice(7));
    if (!token.email)
      return Response.json({ error: "An email/password account is required." }, { status: 403 });
    return { uid: token.uid, email: token.email.toLowerCase(), syncKey: accountSyncKey(token.uid) };
  } catch {
    return Response.json({ error: "Your session has expired. Sign in again." }, { status: 401 });
  }
}

export async function requireIdentity(request: Request): Promise<Identity | Response> {
  const identity = await verifyIdentity(request);
  if (identity instanceof Response) return identity;
  try {
    const registry = getAccountRegistry();
    if (!registry || !(await registry.member(identity.uid, identity.email)))
      return Response.json(
        { error: "This account does not have access to Story Lane." },
        { status: 403 },
      );
    return identity;
  } catch {
    return Response.json(
      { error: "Could not verify workspace access. Please try again." },
      { status: 503 },
    );
  }
}
