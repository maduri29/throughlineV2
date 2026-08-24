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
import BoneyardView from "./views/BoneyardView";
import Logo from "./views/Logo";
import ResearchView from "./views/ResearchView";
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

/**
 * Guards against bouncing to sign-in more than once per page load. Belongs
 * outside the component so a remount cannot reset it mid-loop.
 */
let sentToSignIn = false;

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
  const bootError = useGraphStore((s) => s.bootError);
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

  /** Top-level sections. A story is its own place, not a fourth tab. */
  const section: "stories" | "boneyard" | "research" | "story" = routeId
    ? "story"
    : pathname.startsWith("/boneyard")
      ? "boneyard"
      : pathname.startsWith("/research")
        ? "research"
        : "stories";
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

  /**
   * One place decides where you land, because two did not agree.
   *
   * The root handoff ("/" -> a real URL) and the sign-in gate were separate
   * effects both calling replace, so at "/" they raced and whichever ran last
   * won at random. Deciding once, in order — finish the callback, then ask
   * whether we are signed in, then navigate — is what makes it stable.
   *
   * "/" stays the landing spot because that is where auth links come back to,
   * and the handoff waits for the callback to be spent or the token in the
   * address bar goes with the redirect.
   */
  useEffect(() => {
    if (status === "booting" || completing) return;
    let cancelled = false;

    void (async () => {
      const atRoot = pathname === "/";
      const stay = (): void => {
        if (!atRoot || cancelled) return;
        const pid = useGraphStore.getState().projectId;
        router.replace(pid ? `/stories/${pid}` : "/stories");
      };

      // Mid-callback, or having explicitly chosen to work offline: never bounce.
      if (isAuthCallback() || hasChosenOffline() || sentToSignIn) {
        stay();
        return;
      }
      try {
        const st = await cloudState();
        if (cancelled) return;
        if (st.kind === "signed-in") {
          stay();
          return;
        }
        // Once per load. location.replace restarted the app on every hop, which
        // restarted session restoration, which raced this check again — a
        // sign-in screen that reappeared after signing in successfully, and a
        // store that never finished booting because the page kept reloading.
        sentToSignIn = true;
        router.replace("/signin");
      } catch {
        // Unreadable auth state is not a reason to lock someone out of their own
        // local work. Fail open rather than into a redirect.
        stay();
      }
    })();

    return () => {
      cancelled = true;
    };
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
    // Where to land is decided in one place below, once the callback and boot
    // have both settled. Doing it here as well is what let two redirects race.
    void handleAuthCallback().finally(() => {
      setCompleting(false);
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

        {/* Top-level tabs, only outside a story — inside one, the header is
            already carrying that story's controls and a second row of
            navigation would compete with them. */}
        {section !== "story" && (
          <nav className="tln-nav">
            {(
              [
                ["stories", "Stories", "/stories"],
                ["boneyard", "Boneyard", "/boneyard"],
                ["research", "Research", "/research"],
              ] as const
            ).map(([id, label, href]) => (
              <button
                key={id}
                className={`tln-nav__tab${section === id ? " tln-nav__tab--on" : ""}`}
                onClick={() => router.push(href)}
              >
                {label}
              </button>
            ))}
          </nav>
        )}

        <span className="tln-header__gap" />

        {level === "workspace" && (
          <>
            {/* History first, then the two save indicators (ADR-0007 decision 10)
                as one quiet line, then backup alone. Undo/redo lead because they
                act on the story; the indicators report; download is a rare,
                deliberate act and sits apart for it. */}
            <span className="tln-tools">
              <button className="tln-tool" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
                <svg
                  className="tln-tool__icon"
                  viewBox="0 0 16 16"
                  width="15"
                  height="15"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M3.5 6.5h6a3.5 3.5 0 0 1 0 7H7" />
                  <path d="M6.5 3.5 3.5 6.5l3 3" />
                </svg>
              </button>
              <button
                className="tln-tool"
                onClick={redo}
                disabled={!canRedo}
                title="Redo (Ctrl+Shift+Z)"
              >
                <svg
                  className="tln-tool__icon"
                  viewBox="0 0 16 16"
                  width="15"
                  height="15"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12.5 6.5h-6a3.5 3.5 0 0 0 0 7H9" />
                  <path d="m9.5 3.5 3 3-3 3" />
                </svg>
              </button>
            </span>

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

            <button
              className="tln-tool tln-tool--lone"
              onClick={exportProject}
              title="Download a lossless backup of this story"
            >
              <svg
                className="tln-tool__icon"
                viewBox="0 0 16 16"
                width="15"
                height="15"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M8 2.5V10" />
                <path d="m4.75 7 3.25 3 3.25-3" />
                <path d="M2.75 11.25v.75a1.5 1.5 0 0 0 1.5 1.5h7.5a1.5 1.5 0 0 0 1.5-1.5v-.75" />
              </svg>
            </button>

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

      {/* Boot failures used to be visible only inside a story, because that is
          where the status chip lives. On the shelf, the boneyard and research
          that meant a dead store presented as buttons that silently did nothing
          — which is precisely how it was reported. */}
      {status === "error" && (
        <div className="tln-fault" role="alert">
          <strong>Throughline could not reach this browser&rsquo;s storage.</strong>{" "}
          {bootError ?? "Unknown error."} Nothing you do will be saved until this clears. If the app
          is open in another tab, close it and reload.
          <button className="tln-btn" onClick={() => location.reload()}>
            Reload
          </button>
        </div>
      )}

      {section === "boneyard" ? (
        <BoneyardView onGrown={(id) => router.push(`/stories/${id}`)} />
      ) : section === "research" ? (
        <ResearchView />
      ) : level === "library" ? (
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
