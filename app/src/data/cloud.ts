// Optional Supabase sync tier (ADR-0005).
//
// IndexedDB stays the working store. Nothing in this file is on the read or
// write path of the app; it pushes and pulls whole envelopes on top. If the
// module is not configured, every export here degrades to a no-op and the app
// is exactly the local-first app it was before ADR-0005 — that property is the
// point, not a fallback.
//
// Only the project URL and the PUBLISHABLE key are referenced. Those are safe
// in a client bundle *because* every table has row level security scoped to
// auth.uid() (see supabase/migrations/0001_story_graph.sql). The secret key must
// never appear in this repository or in a build.
import { createClient, type EmailOtpType, type SupabaseClient } from "@supabase/supabase-js";
import { buildEnvelope, parseEnvelope, type Envelope } from "./envelope";
import type { GraphEdge, GraphNode } from "../types";

const URL_KEY = "TLN_SUPABASE_URL";
const PUB_KEY = "TLN_SUPABASE_PUBLISHABLE_KEY";

/**
 * Built-in project, compiled into the bundle so users never see the connect
 * form.
 *
 * These are the PUBLISHABLE credentials, which are safe to ship in a client
 * bundle *because* every table has row level security scoped to auth.uid()
 * (see supabase/migrations/0001_story_graph.sql). They identify the project,
 * they do not authorize anything: without a signed-in user, RLS returns zero
 * rows. The secret key must still never appear here or anywhere in a build.
 *
 * Plain literals, not process.env reads: the production site is served from a
 * Bun-bundled static build where NEXT_PUBLIC_* substitution does not happen,
 * and an unguarded `process` reference would throw in the browser.
 *
 * A user can still point their install elsewhere — localStorage wins over this
 * default, so self-hosters keep their escape hatch.
 */
const BUILTIN_URL = "https://tfybmchbbpamyksbdprs.supabase.co";
const BUILTIN_KEY = "sb_publishable__HI8r8-S6DonTdM1dOPBdQ_5mmRYolA";

export function readConfig(): { url: string; key: string } | null {
  try {
    const url = localStorage.getItem(URL_KEY) ?? BUILTIN_URL;
    const key = localStorage.getItem(PUB_KEY) ?? BUILTIN_KEY;
    return url && key ? { url, key } : null;
  } catch {
    return null; // private mode / storage blocked
  }
}

let client: SupabaseClient | null = null;
let lastAuthEvent: string | null = null;

// Captured at import, before any handler strips the parameters, so the UI can
// know it is mid-sign-in on its very first render rather than flashing the
// sign-in form at someone who has just clicked their link.
const initialUrl = typeof location === "undefined" ? "" : location.search + location.hash;

/**
 * True when this page load is the return leg of a magic link — including the
 * failure leg, which carries `error` instead of a token. Both need the dialog
 * open: a bounced link with nothing on screen is the silent failure this whole
 * redesign exists to remove.
 */
export function isAuthCallback(): boolean {
  return /[?&#](access_token|code|token_hash|error)=/.test(initialUrl);
}

/**
 * True only when there is a token to exchange, so "Signing you in…" is shown
 * for work actually in flight rather than for a link that already failed.
 */
export function isAuthExchangePending(): boolean {
  return /[?&#](access_token|code|token_hash)=/.test(initialUrl);
}

/** Role claim of a legacy JWT key, or null if `key` is not a readable JWT. */
function jwtRole(key: string): string | null {
  const parts = key.split(".");
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    const role: unknown = (JSON.parse(json) as Record<string, unknown>)["role"];
    return typeof role === "string" ? role : null;
  } catch {
    return null; // not a JWT we can read; fall through to the other checks
  }
}

/**
 * Reject bad config *before* it is stored. Returns a problem, or null if usable.
 *
 * The important case is the secret key. The publishable key is safe in a client
 * bundle only because RLS scopes every row to auth.uid(); a secret key BYPASSES
 * row level security entirely, so storing one here would expose every row of
 * every user to anything running on this page. The dashboard shows both keys a
 * few lines apart, which makes it an easy paste to get wrong — so the app has to
 * catch it rather than trust the person pasting.
 */
export function validateConfig(url: string, key: string): string | null {
  const u = url.trim();
  const k = key.trim();
  if (!u) return "Project URL is required.";
  if (!k) return "Publishable key is required.";

  let parsed: URL;
  try {
    parsed = new URL(u);
  } catch {
    return "Project URL is not a valid URL — it should look like https://abcdefg.supabase.co";
  }
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
    return "Project URL must use https (except a local self-hosted instance).";
  }

  if (k.startsWith("sb_secret_")) {
    return "That is the SECRET key — it bypasses row level security and must never go in a browser. Use the publishable (sb_publishable_…) key.";
  }
  if (jwtRole(k) === "service_role") {
    return "That is the service_role key — it bypasses row level security and must never go in a browser. Use the publishable (sb_publishable_…) key.";
  }
  if (!k.startsWith("sb_publishable_") && jwtRole(k) !== "anon") {
    return "That does not look like a publishable key. Copy the key labelled publishable (sb_publishable_…) from Settings → API.";
  }
  return null;
}

/** Stores config, or returns a problem and stores nothing. */
export function writeConfig(url: string, key: string): string | null {
  const problem = validateConfig(url, key);
  if (problem) return problem;
  localStorage.setItem(URL_KEY, url.trim().replace(/\/+$/, ""));
  localStorage.setItem(PUB_KEY, key.trim());
  client = null; // config changed; drop the memoized client so it is rebuilt
  return null;
}

/**
 * Forget any locally-set project. With a built-in project compiled in, this
 * falls back to it rather than leaving the app unconfigured; local stories are
 * untouched either way — sync is a tier above them.
 */
export function clearConfig(): void {
  void client?.auth.signOut();
  localStorage.removeItem(URL_KEY);
  localStorage.removeItem(PUB_KEY);
  client = null;
}

/** True when a project is compiled into this build (not user-configured). */
export function hasBuiltinConfig(): boolean {
  return Boolean(BUILTIN_URL && BUILTIN_KEY);
}

/**
 * True when the project currently in use IS the compiled-in one — i.e. the user
 * has not pointed the app somewhere else. Distinct from hasBuiltinConfig(),
 * which only says a built-in exists; the sign-in UI uses this to decide whether
 * "use the built-in project" would be an action or a no-op.
 */
export function isUsingBuiltinConfig(): boolean {
  try {
    return readConfig()?.url === BUILTIN_URL;
  } catch {
    return false;
  }
}

/** Null whenever sync is not configured. Callers must handle null, not assume. */
export function getClient(): SupabaseClient | null {
  if (client) return client;
  const cfg = readConfig();
  if (!cfg) return null;
  client = createClient(cfg.url, cfg.key, {
    // detectSessionInUrl is the default, but it is the mechanism the whole
    // sign-in depends on — stated explicitly so it cannot be lost silently.
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  client.auth.onAuthStateChange((event) => {
    lastAuthEvent = event;
  });
  return client;
}

/**
 * Fire `cb` on every sign-in and sign-out. Returns an unsubscribe.
 *
 * Polling getSession() once is not enough: the magic-link code exchange happens
 * asynchronously after the client is built, so a single check can read
 * "signed out" a moment before the session actually arrives and then never
 * correct itself — which looks exactly like a failed login.
 */
export function onAuthChange(cb: () => void): () => void {
  const c = getClient();
  if (!c) return () => {};
  const { data } = c.auth.onAuthStateChange(() => {
    cb();
  });
  return () => data.subscription.unsubscribe();
}

let lastCallbackError: string | null = null;

/**
 * Finish a magic-link sign-in, whichever shape the link comes back in.
 *
 * A Supabase email link can land in three different ways, and the client only
 * auto-handles two of them:
 *
 *   1. `#access_token=…`      implicit flow, handled by detectSessionInUrl
 *   2. `?code=…`              PKCE, handled by detectSessionInUrl
 *   3. `?token_hash=…&type=…` needs an explicit verifyOtp call
 *
 * Shape 3 is what a project sends when its email template uses `{{ .TokenHash }}`,
 * and nothing in the SDK picks it up for you. Left unhandled it is a silent
 * no-op: the user returns to the app, no error appears anywhere, and they are
 * still signed out — which is indistinguishable from the link not working.
 *
 * Called at app boot because the link returns to "/", which opens the workspace
 * where the sync panel is not mounted. No-op when sync is unconfigured, so the
 * local-first path is unchanged (ADR-0005).
 */
export async function handleAuthCallback(): Promise<void> {
  const c = getClient();
  if (!c) return;

  const params = new URLSearchParams(location.search);
  const tokenHash = params.get("token_hash");

  if (tokenHash) {
    const type = (params.get("type") ?? "magiclink") as EmailOtpType;
    const { error } = await c.auth.verifyOtp({ token_hash: tokenHash, type });
    lastCallbackError = error ? error.message : null;

    // Spend the token from the address bar either way: leaving it there means a
    // reload retries an already-consumed token and reports a confusing failure.
    const url = new URL(location.href);
    for (const k of ["token_hash", "type"]) url.searchParams.delete(k);
    history.replaceState(null, "", url.toString());
  }

  // Settle before returning, whichever shape this was. getSession() waits on the
  // client's own initialization, which is where the implicit and PKCE flows do
  // their work — so a caller can hold a "signing you in" state until the answer
  // is actually known, instead of guessing at a delay.
  await c.auth.getSession();
}

/**
 * Supabase reports callback failures in the URL rather than by throwing — an
 * expired link, a redirect URL missing from the allow-list, a PKCE verifier
 * from a different browser. Surfacing the text beats a silent bounce back to
 * the sign-in form, which is indistinguishable from never having clicked.
 */
export function readAuthCallbackError(): string | null {
  if (typeof location === "undefined") return lastCallbackError;
  const query = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
  const description = query.get("error_description") ?? hash.get("error_description");
  const code = query.get("error") ?? hash.get("error");
  if (!description && !code) return lastCallbackError;
  return (description ?? code ?? "").replace(/\+/g, " ");
}

/**
 * Which sign-in providers the project actually has switched on.
 *
 * Asked of the project rather than assumed, because "I enabled GitHub" and
 * "GitHub is enabled" are different claims — the dashboard has more than one
 * page that looks like the right one, and the failure is otherwise invisible
 * until a sign-in attempt returns a generic error.
 *
 * Null when it cannot be determined; an empty array means none are on.
 */
export async function enabledProviders(): Promise<string[] | null> {
  const cfg = readConfig();
  if (!cfg) return null;
  try {
    const res = await fetch(`${cfg.url}/auth/v1/settings`, { headers: { apikey: cfg.key } });
    if (!res.ok) return null;
    const json = (await res.json()) as { external?: Record<string, unknown> };
    return Object.entries(json.external ?? {})
      .filter(([, on]) => on === true)
      .map(([name]) => name)
      .sort();
  } catch {
    return null;
  }
}

export type AuthDiagnostics = {
  configured: boolean;
  origin: string;
  landing: string;
  lastEvent: string | null;
  session: boolean;
  storageKeys: number;
  providers: string[] | null;
};

/**
 * What the sign-in actually saw. Reports the *shape* of the callback and whether
 * a session resulted — never token values, which must not end up in a screenshot
 * or a bug report. Exists because this flow leaves the app: it cannot be
 * reproduced locally, so the app has to be able to describe what happened.
 */
export async function authDiagnostics(): Promise<AuthDiagnostics> {
  const configured = readConfig() !== null;
  const query = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.replace(/^#/, ""));

  const shapes: string[] = [];
  if (hash.get("access_token")) shapes.push("#access_token (implicit)");
  if (query.get("code")) shapes.push("?code (pkce)");
  if (query.get("token_hash")) shapes.push("?token_hash (needs verifyOtp)");
  if (query.get("error") ?? hash.get("error")) shapes.push("error");

  const c = getClient();
  const session = c ? Boolean((await c.auth.getSession()).data.session) : false;

  // How many Supabase auth entries exist for this origin. Zero after a sign-in
  // attempt means nothing was ever stored, which separates "exchange failed"
  // from "exchange never ran".
  let storageKeys = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("sb-") && k.includes("auth-token")) storageKeys++;
    }
  } catch {
    storageKeys = -1;
  }

  return {
    configured,
    origin: location.origin,
    landing: shapes.length > 0 ? shapes.join(", ") : "no auth params in URL",
    lastEvent: lastAuthEvent,
    session,
    storageKeys,
    providers: await enabledProviders(),
  };
}

/**
 * Deep link to this project's provider settings.
 *
 * The dashboard has several pages that plausibly look like the place to enable a
 * sign-in provider, and picking the wrong one fails silently — so hand over the
 * exact page rather than a path to navigate. Null when the ref cannot be read.
 */
export function dashboardProvidersUrl(): string | null {
  const cfg = readConfig();
  if (!cfg) return null;
  try {
    const ref = new URL(cfg.url).hostname.split(".")[0];
    if (!ref) return null;
    return `https://supabase.com/dashboard/project/${ref}/auth/providers`;
  } catch {
    return null;
  }
}

/** The origin a magic link must return to; must be in the project's allow-list. */
export function redirectOrigin(): string {
  return typeof location === "undefined" ? "" : location.origin;
}

export type CloudState =
  | { kind: "unconfigured" }
  | { kind: "signed-out" }
  | { kind: "signed-in"; email: string | null };

export async function cloudState(): Promise<CloudState> {
  const c = getClient();
  if (!c) return { kind: "unconfigured" };
  const { data } = await c.auth.getSession();
  const user = data.session?.user;
  return user ? { kind: "signed-in", email: user.email ?? null } : { kind: "signed-out" };
}

/** Magic-link sign-in: no password to store, mishandle, or leak. */
export async function signIn(email: string): Promise<string | null> {
  const c = getClient();
  if (!c) return "Sync is not configured.";
  // Come back to wherever the app is actually being served from. This origin
  // must also be on the project's redirect allow-list, or the link 404s.
  const { error } = await c.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: location.origin },
  });
  return error ? error.message : null;
}

/**
 * GitHub sign-in — the primary path, because it depends on no infrastructure
 * this project has to run. No email is sent (so the built-in mailer's few
 * messages an hour cannot block it) and no password exists to choose, store,
 * leak or reset.
 *
 * On success the browser leaves for GitHub, so the returned value only ever
 * carries a failure worth showing.
 */
export async function signInWithGitHub(): Promise<string | null> {
  const c = getClient();
  if (!c) return "Sync is not configured.";

  // Pre-flight, because signInWithOAuth navigates the whole browser: with the
  // provider disabled Supabase answers the authorize endpoint with raw JSON,
  // which replaces the app with `{"code":400,…}` on screen. Checking first keeps
  // the failure inside the dialog where it can be explained. The message is
  // Supabase's own so explainAuthError gives it the same guidance either way.
  const providers = await enabledProviders();
  if (providers !== null && !providers.includes("github")) {
    return "Unsupported provider: provider is not enabled";
  }

  const { error } = await c.auth.signInWithOAuth({
    provider: "github",
    options: { redirectTo: location.origin },
  });
  return error ? error.message : null;
}

export async function signOut(): Promise<void> {
  await getClient()?.auth.signOut();
}

/**
 * Turn a raw auth error into something the reader can act on.
 *
 * Supabase's messages are accurate and useless on their own: "email rate limit
 * exceeded" names the symptom, not the cause (the built-in mailer sends only a
 * couple of messages an hour and is explicitly not for production) and not the
 * fix. An error the reader cannot act on is only marginally better than silence.
 *
 * Returns null when the raw message already says enough.
 */
export function explainAuthError(message: string): string | null {
  const m = message.toLowerCase();

  if (m.includes("rate limit") || m.includes("too many request") || m.includes("429")) {
    return "Supabase's built-in mailer only sends a couple of messages an hour, and this project has hit that. Earlier attempts did send, so check your inbox for the most recent link — it stays valid for about an hour. To lift the cap, add your own SMTP provider under Project Settings → Authentication → SMTP Settings.";
  }
  if (m.includes("provider is not enabled") || m.includes("unsupported provider")) {
    const base = readConfig()?.url ?? "your project";
    return `GitHub sign-in is not switched on for this project. Enable it under Authentication → Providers → GitHub, pasting the Client ID and Client Secret from a GitHub OAuth app whose Authorization callback URL is ${base}/auth/v1/callback.`;
  }
  if (m.includes("signups not allowed") || m.includes("signup is disabled")) {
    return "This project has email sign-ups turned off. Either enable them under Authentication → Providers → Email, or create your user directly under Authentication → Users and sign in as that address.";
  }
  if (m.includes("redirect") && m.includes("not allowed")) {
    return `Add ${redirectOrigin()} to Authentication → URL Configuration → Redirect URLs. Supabase refuses to send people to an origin it does not know.`;
  }
  if (m.includes("invalid") && m.includes("expired")) {
    return "Sign-in links are single-use and expire after about an hour. Request a fresh one.";
  }
  if (m.includes("failed to fetch") || m.includes("networkerror")) {
    return "The project URL could not be reached at all. Check it is the Project URL from Settings → API, and that the project is not paused.";
  }
  return null;
}

export type PushResult = { ok: true; revision: number } | { ok: false; error: string };

/**
 * Push one project as a whole envelope.
 *
 * Last-write-wins per project, deliberately (ADR-0005): with one writer per
 * account it is predictable, and it is NOT collaboration. Two devices editing
 * the same project at once will lose one side — the UI must say that plainly
 * rather than implying a merge this does not perform.
 */
export async function pushProject(
  project: GraphNode,
  nodes: Record<string, GraphNode>,
  edges: Record<string, GraphEdge>,
): Promise<PushResult> {
  const c = getClient();
  if (!c) return { ok: false, error: "Sync is not configured." };
  const { data: sess } = await c.auth.getSession();
  const owner = sess.session?.user.id;
  if (!owner) return { ok: false, error: "Not signed in." };

  const envelope = buildEnvelope(project, nodes, edges);
  const { data, error } = await c
    .from("projects")
    .upsert(
      {
        owner_id: owner,
        local_id: project.id,
        title: project.title,
        schema_version: envelope.schemaVersion,
        payload: envelope,
      },
      { onConflict: "owner_id,local_id" },
    )
    .select("revision")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, revision: (data as { revision: number }).revision };
}

export type RemoteProject = {
  localId: string;
  title: string;
  updatedAt: string;
  revision: number;
};

export async function listRemote(): Promise<RemoteProject[]> {
  const c = getClient();
  if (!c) return [];
  const { data, error } = await c
    .from("projects")
    .select("local_id,title,updated_at,revision")
    .order("updated_at", { ascending: false });
  if (error || !data) return [];
  return data.map((r) => ({
    localId: r.local_id as string,
    title: r.title as string,
    updatedAt: r.updated_at as string,
    revision: r.revision as number,
  }));
}

/**
 * Pull one project back as an envelope.
 *
 * The payload is re-validated through parseEnvelope rather than trusted: it is
 * the same untrusted-input path as a file the user picks, and a row could have
 * been written by an older or newer build.
 */
export async function pullProject(localId: string): Promise<Envelope | string> {
  const c = getClient();
  if (!c) return "Sync is not configured.";
  const { data, error } = await c
    .from("projects")
    .select("payload")
    .eq("local_id", localId)
    .single();
  if (error) return error.message;
  const parsed = parseEnvelope(JSON.stringify((data as { payload: unknown }).payload));
  return parsed.ok ? parsed.envelope : parsed.error;
}
