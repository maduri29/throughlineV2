import { requireIdentity } from "../../../../lib/auth-server";
import { parseAccounts } from "../../../../lib/account-policy";
import { getAccountRegistry } from "../../../../lib/account-registry";

export async function GET(request: Request) {
  const identity = await requireIdentity(request);
  if (identity instanceof Response) return identity;
  const owner = parseAccounts(process.env.THROUGHLINE_ACCOUNTS)[0];
  if (!owner || owner.uid !== identity.uid || owner.email !== identity.email)
    return Response.json({ owner: false }, { headers: { "Cache-Control": "no-store" } });
  try {
    const registry = getAccountRegistry();
    if (!registry)
      return Response.json({ error: "Account storage is unavailable." }, { status: 503 });
    const used = await registry.count();
    const code = process.env.THROUGHLINE_INVITE_CODE;
    return Response.json(
      {
        owner: true,
        code: code && code.length >= 12 ? code : null,
        used,
        limit: 5,
        remaining: Math.max(0, 5 - used),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ error: "Could not load invitations. Try again." }, { status: 503 });
  }
}
