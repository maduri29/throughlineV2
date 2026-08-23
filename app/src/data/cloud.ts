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
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { buildEnvelope, parseEnvelope, type Envelope } from "./envelope";
import type { GraphEdge, GraphNode } from "../types";

const URL_KEY = "TLN_SUPABASE_URL";
const PUB_KEY = "TLN_SUPABASE_PUBLISHABLE_KEY";

/**
 * Config is read from localStorage rather than a build-time env var so the same
 * static bundle works signed-out, and so a user can point a self-hosted instance
 * at it without a rebuild. Absent config is the normal case, not an error.
 */
export function readConfig(): { url: string; key: string } | null {
  try {
    const url = localStorage.getItem(URL_KEY);
    const key = localStorage.getItem(PUB_KEY);
    return url && key ? { url, key } : null;
  } catch {
    return null; // private mode / storage blocked
  }
}

let client: SupabaseClient | null = null;

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

/** Forget the project entirely. Local stories are untouched — sync is a tier above them. */
export function clearConfig(): void {
  void client?.auth.signOut();
  localStorage.removeItem(URL_KEY);
  localStorage.removeItem(PUB_KEY);
  client = null;
}

/** Null whenever sync is not configured. Callers must handle null, not assume. */
export function getClient(): SupabaseClient | null {
  if (client) return client;
  const cfg = readConfig();
  if (!cfg) return null;
  client = createClient(cfg.url, cfg.key, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return client;
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

export async function signOut(): Promise<void> {
  await getClient()?.auth.signOut();
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
