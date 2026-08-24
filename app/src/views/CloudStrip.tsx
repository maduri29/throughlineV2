// The cloud, reduced to what is still worth saying (ADR-0007).
//
// This replaces the old "Cloud copies" panel, which listed remote stories and
// offered Push and Pull buttons. All three of those jobs moved: pushes are
// debounced after edits, pulls happen when a story is opened, and syncLibrary()
// puts account stories on the shelf as ordinary cards. A panel that duplicates
// automatic machinery invites people to poke at it and teaches them the machine
// cannot be trusted.
//
// What remains: who you are, how much is up there, and one honest escape hatch
// for when you want to be sure before closing the laptop.
import { useCallback, useEffect, useState } from "react";
import { cloudState, listRemote, onAuthChange, type CloudState } from "../data/cloud";
import { readGate } from "../data/cloudSync";
import { useGraphStore } from "../store";

export default function CloudStrip({
  onSignIn,
  onRefreshed,
}: {
  onSignIn: () => void;
  onRefreshed: () => void;
}) {
  const [state, setState] = useState<CloudState | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [online, setOnline] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await cloudState();
      setState(s);
      setOnline((await readGate()).online);
      setCount(s.kind === "signed-in" ? (await listRemote()).length : null);
    } catch {
      setState({ kind: "signed-out" });
    }
  }, []);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    void refresh();
    return onAuthChange(() => {
      void refresh();
    });
  }, [refresh]);

  const syncNow = (): void => {
    setBusy(true);
    setNote(null);
    void useGraphStore
      .getState()
      .syncAllNow()
      .then(async (stranded) => {
        setBusy(false);
        setNote(
          stranded === 0
            ? "Everything is in your account."
            : `${stranded} ${stranded === 1 ? "story" : "stories"} could not be uploaded — they are still safe on this device.`,
        );
        await refresh();
        onRefreshed();
      });
  };

  if (state === null) return null;

  if (state.kind !== "signed-in") {
    return (
      <aside className="tln-cloudstrip tln-cloudstrip--out">
        <div>
          <p className="tln-cloudstrip__head">These stories live only in this browser</p>
          <p className="tln-cloudstrip__body">
            Sign in and they follow you between machines, and survive losing this one.
          </p>
        </div>
        <button className="tln-btn tln-btn--accent" onClick={onSignIn}>
          Sign in
        </button>
      </aside>
    );
  }

  return (
    <aside className="tln-cloudstrip">
      <span className="tln-cloudstrip__who">
        <i
          className={`tln-status__dot ${online ? "tln-status__cloud--synced" : "tln-status__cloud--offline"}`}
        />
        {state.email ?? "your account"}
      </span>
      <span className="tln-cloudstrip__body">
        {!online
          ? "Offline — changes will sync when the connection returns"
          : count === null
            ? "Checking your account…"
            : count === 0
              ? "Nothing in your account yet; it fills as you write"
              : `${count} ${count === 1 ? "story" : "stories"} in your account, kept up to date as you write`}
      </span>
      {/* Not the normal way to sync — the app already does that. This is for the
          moment before you close the laptop and want to have checked. */}
      <button className="tln-btn" disabled={busy || !online} onClick={syncNow}>
        {busy ? "Checking…" : "Sync now"}
      </button>
      {note && <p className="tln-cloudstrip__note">{note}</p>}
    </aside>
  );
}
