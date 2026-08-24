import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  cloudState,
  handleAuthCallback,
  isAuthCallback,
  isAuthExchangePending,
  onAuthChange,
} from "./data/cloud";
import { cloudLabel } from "./data/sync";
import { hasChosenOffline } from "./views/SignInScreen";
import { useGraphStore } from "./store";
import AuthDialog from "./views/AuthDialog";
import Logo from "./views/Logo";
import MapView from "./views/MapView";
import TimelineView from "./views/TimelineView";
import CharactersView from "./views/CharactersView";
import ScriptView from "./views/ScriptView";
import LibraryView from "./views/LibraryView";
import Inspector from "./views/Inspector";
import ConnectionAdd from "./views/ConnectionAdd";
import Palette from "./views/Palette";

const SAVE_LABEL: Record<string, string> = {
  booting: "Loading…",
  saved: "Saved on this device",
  saving: "Saving…",
  dirty: "Unsaved edits",
  error: "Save failed — retry with Ctrl+S",
};

type Lens = "map" | "timeline" | "characters" | "script";

const LENSES: Array<[Lens, string]> = [
  ["map", "Map"],
  ["timeline", "Timeline"],
  ["characters", "Characters"],
  ["script", "Script"],
];

export default function App() {
  const status = useGraphStore((s) => s.status);
  const canUndo = useGraphStore((s) => s.canUndo);
  const canRedo = useGraphStore((s) => s.canRedo);
  const undo = useGraphStore((s) => s.undo);
  const redo = useGraphStore((s) => s.redo);
  const forceSave = useGraphStore((s) => s.forceSave);
  const exportProject = useGraphStore((s) => s.exportProject);
  const projectId = useGraphStore((s) => s.projectId);
  const cloud = useGraphStore((s) => s.cloud);
  const [lens, setLens] = useState<Lens>("map");
  const router = useRouter();
  const pathname = usePathname();

  /**
   * The route decides what is on screen, not component state.
   *
   * "/stories" is the Library; "/stories/<id>" is that story. Deriving rather
   * than storing it is what makes back, forward, refresh and a pasted link all
   * behave — the previous `level` state was invisible to every one of them.
   */
  const routeId = pathname.startsWith("/stories/")
    ? decodeURIComponent(pathname.slice("/stories/".length))
    : null;
  const level: "library" | "workspace" = routeId ? "workspace" : "library";
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Opened automatically when this page load is the return leg of a magic link,
  // so the sign-in narrates itself instead of resolving invisibly.
  const [completing, setCompleting] = useState(() => isAuthExchangePending());
  const [authOpen, setAuthOpen] = useState(() => isAuthCallback());
  const [account, setAccount] = useState<string | null>(null);

  useEffect(() => {
    const read = (): void => {
      void cloudState().then((s) => {
        setAccount(s.kind === "signed-in" ? (s.email ?? "account") : null);
        if (s.kind !== "signed-in") return;
        // Signing in adopts what is already here (decision 5), then brings down
        // anything this device has never seen. Order matters: uploading first
        // means a story written offline cannot be mistaken for a stale copy of
        // something the account already holds.
        const store = useGraphStore.getState();
        void store
          .adoptLocalStories()
          .then(() => store.syncLibrary())
          .then(() => store.pullCurrent());
      });
    };
    read();
    return onAuthChange(read);
  }, []);

  // "/" stays the landing spot because that is where auth links come back to;
  // handing off to a real URL waits until the callback has been spent, or the
  // token in the address bar would be thrown away with the redirect.
  useEffect(() => {
    if (pathname !== "/" || status === "booting" || completing) return;
    const pid = useGraphStore.getState().projectId;
    router.replace(pid ? `/stories/${pid}` : "/stories");
  }, [pathname, status, completing, router]);

  useEffect(() => {
    if (!routeId) return;
    const s = useGraphStore.getState();
    if (s.projectId !== routeId) void s.switchProject(routeId);
  }, [routeId]);

  /** Palette jump: pick the lens that shows the node best. */
  const jumpTo = (id: string, type: string): void => {
    const pid = useGraphStore.getState().projectId;
    if (pid && !routeId) router.push(`/stories/${pid}`);
    setLens(type === "character" ? "characters" : "map");
    useGraphStore.getState().select([id]);
  };

  useEffect(() => {
    void useGraphStore.getState().boot();
    // A magic link returns to "/", so the callback has to be finished here — the
    // dialog may never be opened, and nothing else would spend the token in the
    // URL. No-op when sync is unconfigured, so the local-first boot path is
    // unchanged (ADR-0005).
    //
    // The dialog is opened for the duration either way: someone who has just
    // clicked a sign-in link should see it resolve, success or failure, rather
    // than land in the workspace with no sign that anything happened.
    void handleAuthCallback().finally(() => {
      setCompleting(false);
      // Sign-in first (ADR-0007 decision 6). Checked only after the callback
      // settles, so someone returning from a link is never bounced back to the
      // screen they just came from. The offline choice is remembered, not re-asked.
      if (isAuthCallback() || hasChosenOffline()) return;
      void cloudState().then((st) => {
        if (st.kind !== "signed-in") location.replace("/signin");
      });
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void forceSave();
      } else if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      } else if (mod && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
      } else if (
        (mod && e.shiftKey && e.key.toLowerCase() === "z") ||
        (mod && e.key.toLowerCase() === "y")
      ) {
        e.preventDefault();
        redo();
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [undo, redo, forceSave]);

  const project = projectId ? useGraphStore.getState().nodes[projectId] : undefined;

  return (
    <div className="tln-app">
      <header className="tln-header">
        {/* Brand doubles as the way back to the shelf. Everything after it is
            story-specific and rendered only inside a story: undo, lenses, backup
            and a save indicator are all meaningless on a list of stories, and
            showing them there made the toolbar look broken rather than full. */}
        <button className="tln-brand" onClick={() => router.push("/stories")} title="All stories">
          <Logo />
          <span className="tln-brand__name">Throughline</span>
        </button>

        {level === "workspace" && (
          <>
            <span className="tln-header__crumb" aria-hidden="true">
              /
            </span>
            <span className="tln-header__title">{project?.title ?? ""}</span>
          </>
        )}

        <span className="tln-header__gap" />

        {level === "workspace" && (
          <>
            {/* Two indicators (ADR-0007 decision 10), but one object: they answer
                the same question at different distances, and the local half never
                shows a bare tick — saved here is not saved anywhere else. */}
            <span className="tln-status">
              <span className={`tln-status__part tln-status__local--${status}`}>
                <i className="tln-status__dot" aria-hidden="true" />
                {status === "error"
                  ? (useGraphStore.getState().bootError ?? "Save failed")
                  : SAVE_LABEL[status]}
              </span>
              <span className={`tln-status__part tln-status__cloud--${cloud}`}>
                <i className="tln-status__dot" aria-hidden="true" />
                {cloudLabel(cloud)}
              </span>
            </span>

            <span className="tln-tools">
              <button className="tln-tool" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
                ↶
              </button>
              <button
                className="tln-tool"
                onClick={redo}
                disabled={!canRedo}
                title="Redo (Ctrl+Shift+Z)"
              >
                ↷
              </button>
              <button
                className="tln-tool"
                onClick={exportProject}
                title="Download a lossless backup of this story"
              >
                ↓
              </button>
            </span>

            <span className="tln-lens-tabs">
              {LENSES.map(([id, label]) => (
                <button
                  key={id}
                  className={`tln-lens-tab${lens === id ? " tln-lens-tab--on" : ""}`}
                  onClick={() => setLens(id)}
                >
                  {label}
                </button>
              ))}
            </span>
          </>
        )}

        <button
          className={`tln-account${account ? " tln-account--on" : ""}`}
          onClick={() => setAuthOpen(true)}
          title={account ? `Signed in as ${account}` : "Sign in to sync across devices"}
        >
          {account ? (
            <span className="tln-account__dot" aria-hidden="true">
              {account.slice(0, 1).toUpperCase()}
            </span>
          ) : (
            "Sign in"
          )}
        </button>
      </header>

      {level === "library" ? (
        <LibraryView
          onSignIn={() => setAuthOpen(true)}
          onOpen={(id) => router.push(`/stories/${id}`)}
        />
      ) : (
        <div className="tln-workspace">
          <div className="tln-workspace__lens">
            {lens === "map" ? <MapView /> : null}
            {lens === "timeline" ? <TimelineView /> : null}
            {lens === "characters" ? <CharactersView /> : null}
            {lens === "script" ? <ScriptView /> : null}
          </div>
          {lens !== "script" && lens !== "characters" ? (
            <div className="tln-dock">
              <Inspector />
              <ConnectionAdd />
            </div>
          ) : null}
        </div>
      )}
      <Palette open={paletteOpen} onClose={() => setPaletteOpen(false)} onJump={jumpTo} />
      <AuthDialog
        open={authOpen}
        completing={completing}
        onClose={() => {
          setAuthOpen(false);
        }}
      />
    </div>
  );
}
