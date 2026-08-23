// Cloud copies of stories. Sync actions only — authentication moved to
// AuthDialog, because pushing a story and proving who you are are different
// jobs and stacking them made both harder to read.
//
// cloud.ts is still off every read and write path: an unconfigured or signed-out
// user gets exactly the local-first app that shipped before ADR-0005.
//
// The copy stays blunt about what the two buttons really do. Pushes replace the
// cloud copy wholesale and pulls arrive as a NEW story; sync UIs that imply
// merging they do not perform are how people lose work.
import { useCallback, useEffect, useState } from "react";
import {
  cloudState,
  listRemote,
  onAuthChange,
  pullProject,
  pushProject,
  type CloudState,
  type RemoteProject,
} from "../data/cloud";
import { envelopeToJson } from "../data/envelope";
import { useGraphStore } from "../store";

type Message = { kind: "ok" | "err"; text: string };

export default function SyncPanel({ onSignIn }: { onSignIn: () => void }) {
  const projectId = useGraphStore((s) => s.projectId);
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const importProject = useGraphStore((s) => s.importProject);

  const [state, setState] = useState<CloudState | null>(null);
  const [remote, setRemote] = useState<RemoteProject[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Message | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await cloudState();
      setState(s);
      setRemote(s.kind === "signed-in" ? await listRemote() : []);
    } catch {
      setState({ kind: "unconfigured" });
      setRemote([]);
    }
  }, []);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    void refresh();
    return onAuthChange(() => {
      void refresh();
    });
  }, [refresh]);

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
    // could have been written by an older or newer build, so it is untrusted
    // input, and arriving as a new story means a pull can never eat local edits.
    const err = await importProject(envelopeToJson(env));
    setBusy(false);
    setMsg(
      err
        ? { kind: "err", text: err }
        : { kind: "ok", text: `Pulled “${r.title}” as a new story.` },
    );
  };

  const openTitle = projectId ? nodes[projectId]?.title : undefined;

  return (
    <section className="tln-sync">
      <h2 className="tln-sync__head">Cloud copies</h2>

      {state?.kind !== "signed-in" ? (
        <div className="tln-sync__row">
          <span className="tln-sync__note">
            {state?.kind === "unconfigured"
              ? "Not set up. Your stories live on this machine only."
              : "Signed out. Your stories live on this machine only."}
          </span>
          <button className="tln-btn" onClick={onSignIn}>
            {state?.kind === "unconfigured" ? "Set up cloud sync" : "Sign in"}
          </button>
        </div>
      ) : (
        <>
          <div className="tln-sync__row">
            <button
              className="tln-btn"
              disabled={busy || !projectId}
              onClick={() => void onPush()}
              title="Replace the cloud copy of the open story"
            >
              {openTitle ? `Push “${openTitle}”` : "Push"}
            </button>
            <span className="tln-sync__note">
              Replaces the cloud copy outright — last-write-wins, not collaboration.
            </span>
          </div>

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
