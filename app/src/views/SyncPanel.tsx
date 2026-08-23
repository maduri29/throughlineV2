// Optional cloud sync surface (ADR-0005).
//
// Every piece of cloud state lives in this one component on purpose. cloud.ts is
// not imported anywhere on a read or write path, so an unconfigured or
// signed-out user gets exactly the local-first app that shipped before ADR-0005
// — that property is the design, not a fallback, and splitting sync state into
// the global store would quietly end it.
//
// The copy here is deliberately blunt about two things the code really does:
// pushes overwrite the server copy wholesale, and pulls arrive as a NEW story.
// Sync UIs that imply merging when they do not merge are how people lose work.
import { useCallback, useEffect, useState } from "react";
import {
  clearConfig,
  cloudState,
  listRemote,
  onAuthChange,
  pullProject,
  pushProject,
  readAuthCallbackError,
  readConfig,
  redirectOrigin,
  signIn,
  signOut,
  writeConfig,
  type CloudState,
  type RemoteProject,
} from "../data/cloud";
import { envelopeToJson } from "../data/envelope";
import { useGraphStore } from "../store";

type Message = { kind: "ok" | "err"; text: string };

export default function SyncPanel() {
  const projectId = useGraphStore((s) => s.projectId);
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const importProject = useGraphStore((s) => s.importProject);

  const [state, setState] = useState<CloudState | null>(null);
  const [remote, setRemote] = useState<RemoteProject[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Message | null>(null);

  const [url, setUrl] = useState(() => readConfig()?.url ?? "");
  // Never pre-filled from storage: echoing a stored credential back into the DOM
  // puts it in every screenshot, bug report and accessibility tree for no gain.
  const [key, setKey] = useState("");
  const [email, setEmail] = useState("");

  const refresh = useCallback(async () => {
    // Never leave the panel stuck on "Checking…". Building the client can throw
    // on a URL that passed validation but is not really a Supabase project, and
    // a spinner that never resolves reads as a broken app with no way forward.
    try {
      const s = await cloudState();
      setState(s);
      setRemote(s.kind === "signed-in" ? await listRemote() : []);
    } catch (err) {
      setState({ kind: "unconfigured" });
      setRemote([]);
      setMsg({ kind: "err", text: `Could not reach that project — ${String(err)}` });
    }
  }, []);

  useEffect(() => {
    // Reading the stored auth session is the "synchronize with an external
    // system" case the rule exempts; it just cannot see past the await inside
    // refresh(), so no setState here actually runs synchronously.
    // oxlint-disable-next-line react/set-state-in-effect
    void refresh();

    // A failed magic link comes back as text in the URL, not as an exception.
    const callbackError = readAuthCallbackError();
    if (callbackError) {
      // oxlint-disable-next-line react/set-state-in-effect
      setMsg({ kind: "err", text: `Sign-in link failed — ${callbackError}` });
    }

    // Keep listening. The code exchange completes after this effect runs, so
    // without this the panel would still be showing the sign-in form at the
    // moment the session actually arrives.
    return onAuthChange(() => {
      void refresh();
    });
  }, [refresh]);

  const onSaveConfig = (): void => {
    const problem = writeConfig(url, key);
    if (problem) {
      setMsg({ kind: "err", text: problem });
      return;
    }
    setKey("");
    setMsg({ kind: "ok", text: "Project saved. Sign in to sync." });
    void refresh();
  };

  const onDisconnect = (): void => {
    clearConfig();
    setUrl("");
    setKey("");
    setMsg({ kind: "ok", text: "Disconnected. Your stories are still on this machine." });
    void refresh();
  };

  const onSignIn = async (): Promise<void> => {
    setBusy(true);
    const err = await signIn(email.trim());
    setBusy(false);
    setMsg(
      err
        ? { kind: "err", text: err }
        : {
            kind: "ok",
            // Naming the origin matters: the single most common failure is that
            // it is missing from the project's redirect allow-list, and the only
            // symptom is a link that bounces somewhere else entirely.
            text: `Sign-in link sent to ${email.trim()}. Open it in THIS browser — it returns to ${redirectOrigin()}, which must be listed under Authentication → URL Configuration → Redirect URLs.`,
          },
    );
  };

  const onSignOut = async (): Promise<void> => {
    await signOut();
    setMsg(null);
    void refresh();
  };

  const onPush = async (): Promise<void> => {
    const project = projectId ? nodes[projectId] : undefined;
    if (!project) {
      setMsg({ kind: "err", text: "Open a story first — push sends the story you have open." });
      return;
    }
    setBusy(true);
    const res = await pushProject(project, nodes, edges);
    setBusy(false);
    if (!res.ok) {
      setMsg({ kind: "err", text: res.error });
      return;
    }
    setMsg({ kind: "ok", text: `Pushed “${project.title}” — revision ${res.revision}.` });
    void refresh();
  };

  const onPull = async (r: RemoteProject): Promise<void> => {
    setBusy(true);
    const env = await pullProject(r.localId);
    if (typeof env === "string") {
      setBusy(false);
      setMsg({ kind: "err", text: env });
      return;
    }
    // Routed through the same validated import as a file the user picks: a row
    // could have been written by an older or a newer build, so it is untrusted
    // input, and arriving as a new story means a pull can never eat local edits.
    const err = await importProject(envelopeToJson(env));
    setBusy(false);
    setMsg(
      err
        ? { kind: "err", text: err }
        : { kind: "ok", text: `Pulled “${r.title}” in as a new story.` },
    );
  };

  const openTitle = projectId ? nodes[projectId]?.title : undefined;

  return (
    <section className="tln-sync">
      <h2 className="tln-sync__head">Cloud sync</h2>

      {state === null && <p className="tln-sync__note">Checking…</p>}

      {state?.kind === "unconfigured" && (
        <>
          {/* Numbered because connecting and signing in really are two steps in
              sequence, and the second one is invisible until the first lands —
              which reads as a missing sign-in rather than a step not yet reached. */}
          <h3 className="tln-sync__subhead">Step 1 of 2 · Connect your project</h3>
          <p className="tln-sync__note">
            Optional. Without it Throughline works exactly as it does now, entirely on this machine.
            Connect a Supabase project to keep a copy off this device. Signing in comes next.
          </p>
          <div className="tln-sync__row">
            <input
              className="tln-sync__input"
              placeholder="https://your-project.supabase.co"
              aria-label="Supabase project URL"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <input
              className="tln-sync__input"
              type="password"
              placeholder="sb_publishable_…"
              aria-label="Supabase publishable key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
            <button className="tln-btn" onClick={onSaveConfig}>
              Connect
            </button>
          </div>
          <p className="tln-sync__warn">
            Use the <strong>publishable</strong> key. Never paste the secret or service_role key
            here — it bypasses row-level security and would expose every account.
          </p>
        </>
      )}

      {state?.kind === "signed-out" && (
        <>
          <h3 className="tln-sync__subhead">Step 2 of 2 · Sign in</h3>
          <p className="tln-sync__note">
            Connected to {readConfig()?.url ?? ""}. Enter your email and we send a sign-in link —
            there is no password to store or leak. Open the link in this browser.
          </p>
          <div className="tln-sync__row">
            <input
              className="tln-sync__input"
              type="email"
              placeholder="you@example.com"
              aria-label="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && email.trim()) void onSignIn();
              }}
            />
            <button
              className="tln-btn"
              disabled={busy || !email.trim()}
              onClick={() => void onSignIn()}
            >
              Email me a link
            </button>
            <button className="tln-btn" onClick={onDisconnect}>
              Disconnect
            </button>
          </div>
        </>
      )}

      {state?.kind === "signed-in" && (
        <>
          <div className="tln-sync__row">
            <span className="tln-sync__note">Signed in as {state.email ?? "unknown"}</span>
            <button
              className="tln-btn"
              disabled={busy || !projectId}
              onClick={() => void onPush()}
              title="Send the open story to the cloud"
            >
              {openTitle ? `Push “${openTitle}”` : "Push"}
            </button>
            <button className="tln-btn" disabled={busy} onClick={() => void onSignOut()}>
              Sign out
            </button>
            <button className="tln-btn" onClick={onDisconnect}>
              Disconnect
            </button>
          </div>

          <p className="tln-sync__warn">
            Pushing replaces the cloud copy of that story outright. This is last-write-wins, not
            collaboration — edit the same story on two devices at once and one side&rsquo;s work is
            lost.
          </p>

          <h3 className="tln-sync__subhead">In the cloud</h3>
          {remote.length === 0 ? (
            <p className="tln-sync__note">Nothing pushed yet.</p>
          ) : (
            <ul className="tln-sync__remote">
              {remote.map((r) => (
                <li key={r.localId} className="tln-sync__remote-item">
                  <span className="tln-sync__remote-title">{r.title}</span>
                  <span className="tln-sync__note">
                    rev {r.revision} · {new Date(r.updatedAt).toLocaleString()}
                  </span>
                  <button className="tln-btn" disabled={busy} onClick={() => void onPull(r)}>
                    Pull
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="tln-sync__note">
            A pull arrives as a new story on this machine. Nothing local is overwritten.
          </p>
        </>
      )}

      {msg && (
        <p className={`tln-sync__msg${msg.kind === "err" ? " tln-sync__msg--err" : ""}`}>
          {msg.text}
        </p>
      )}
    </section>
  );
}
