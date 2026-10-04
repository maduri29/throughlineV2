import { loginConfigured } from "../../../../lib/auth-server";
import { getAccountRegistry } from "../../../../lib/account-registry";

export async function GET() {
  const registry = getAccountRegistry();
  const registrationEnabled = Boolean(
    loginConfigured() &&
    process.env.THROUGHLINE_INVITE_CODE &&
    process.env.THROUGHLINE_INVITE_CODE.length >= 12 &&
    registry,
  );
  try {
    const remaining = registry ? Math.max(0, 5 - (await registry.count())) : 0;
    return Response.json(
      { configured: loginConfigured(), registrationEnabled, remaining },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ error: "Could not check account setup." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!loginConfigured())
    return Response.json({ error: "Login setup is incomplete." }, { status: 503 });
  try {
    const body: unknown = await request.json();
    if (
      !body ||
      typeof body !== "object" ||
      !("login" in body) ||
      typeof body.login !== "string" ||
      body.login.length > 254
    )
      return Response.json({ error: "Enter your username or email." }, { status: 400 });
    const account = await getAccountRegistry()?.find(body.login);
    if (!account)
      return Response.json(
        { error: "Check your sign-in details or contact the workspace owner." },
        { status: 403 },
      );
    return Response.json({ email: account.email }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json(
      { error: "Could not look up your account. Please try again." },
      { status: 503 },
    );
  }
}
