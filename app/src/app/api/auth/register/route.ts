import { createHash, timingSafeEqual } from "node:crypto";
import { verifyIdentity } from "../../../../lib/auth-server";
import { AccountRegistrationError, getAccountRegistry } from "../../../../lib/account-registry";

export async function POST(request: Request) {
  const secret = process.env.THROUGHLINE_INVITE_CODE;
  const registry = getAccountRegistry();
  if (!secret || secret.length < 12 || !registry)
    return Response.json(
      { error: "Account creation is not configured. Contact the workspace owner." },
      { status: 503 },
    );
  try {
    const body: unknown = await request.json();
    if (
      !body ||
      typeof body !== "object" ||
      !("username" in body) ||
      typeof body.username !== "string" ||
      !("inviteCode" in body) ||
      typeof body.inviteCode !== "string"
    )
      return Response.json({ error: "Enter a username and invitation code." }, { status: 400 });
    const username = body.username.trim().toLowerCase();
    if (!/^[a-z0-9_.-]{2,32}$/.test(username))
      return Response.json(
        { error: "Use 2–32 letters, numbers, dots, underscores or hyphens for your username." },
        { status: 400 },
      );
    const digest = (value: string) => createHash("sha256").update(value).digest();
    if (!timingSafeEqual(digest(secret), digest(body.inviteCode.trim())))
      return Response.json({ error: "The invitation code is incorrect." }, { status: 403 });
    const identity = await verifyIdentity(request);
    if (identity instanceof Response) return identity;
    await registry.register({ uid: identity.uid, email: identity.email, username });
    return Response.json({ uid: identity.uid, email: identity.email, username }, { status: 201 });
  } catch (error) {
    if (error instanceof AccountRegistrationError)
      return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof SyntaxError)
      return Response.json({ error: "Invalid account request." }, { status: 400 });
    return Response.json(
      { error: "Could not create your workspace. Please try again." },
      { status: 503 },
    );
  }
}
