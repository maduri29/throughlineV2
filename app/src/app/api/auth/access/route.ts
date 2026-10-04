import { requireIdentity } from "../../../../lib/auth-server";
import { getAccountRegistry } from "../../../../lib/account-registry";

export async function GET(request: Request) {
  const identity = await requireIdentity(request);
  if (identity instanceof Response) return identity;
  return Response.json(
    {
      uid: identity.uid,
      email: identity.email,
      username: (await getAccountRegistry()?.find(identity.email))?.username,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
