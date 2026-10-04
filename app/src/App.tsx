import ScriptDownloads from "./views/ScriptDownloads";
import { LENSES, SECTIONS, type Lens } from "./shell/navigation";
import { StoryOrigins } from "./views/boneyard/StoryOrigins";
import { useWorkspaceTheme } from "./shell/useWorkspaceTheme";
import { usePathname, useRouter } from "next/navigation";
import { lazy, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { Activity, Cloud, CloudCheck, Laptop, RefreshCw, Search, UserRound } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useGraphStore } from "./store";
import { checkTursoConfigured } from "./data/sync";
import { getWorkspaceAccount } from "./data/account";
import Loader from "./views/Loader";
import Logo from "./views/Logo";
import LibraryView from "./views/LibraryView";
import Inspector from "./views/Inspector";
import ConnectionAdd from "./views/ConnectionAdd";

const MapView = lazy(() => import("./views/MapView"));
const TimelineView = lazy(() => import("./views/TimelineView"));
const CharactersView = lazy(() => import("./views/CharactersView"));
const BoneyardView = lazy(() => import("./views/BoneyardView"));
const ResearchView = lazy(() => import("./views/ResearchView"));
const ScriptView = lazy(() => import("./views/ScriptView"));
const Palette = lazy(() => import("./views/Palette"));
const StoryDiagnosticsModal = lazy(() => import("./views/StoryDiagnosticsModal"));

const SAVE_LABEL: Record<string, string> = {
  booting: "Loading…",
  saved: "Saved on this device",
  saving: "Saving…",
  dirty: "Unsaved edits",
  error: "Save failed — retry with Ctrl+S",
};

export default function App() {
  const { status, canUndo, canRedo, undo, redo, forceSave, bootError, syncStatus, syncMessage } =
    useGraphStore(
      useShallow((s) => ({
        status: s.status,
        canUndo: s.canUndo,
        canRedo: s.canRedo,
        undo: s.undo,
        redo: s.redo,
        forceSave: s.forceSave,
        bootError: s.bootError,
        syncStatus: s.syncStatus,
        syncMessage: s.syncMessage,
      })),
    );
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [lens, setLens] = useState<Lens>("map");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { theme, toggleTheme } = useWorkspaceTheme();
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

  // "/" is where the app is entered; hand off to a real URL once boot has
  // settled so the shelf and each story keep addressable paths.
  useEffect(() => {
    if (pathname !== "/" || status === "booting") return;
    const pid = useGraphStore.getState().projectId;
    router.replace(pid ? `/stories/${pid}` : "/stories");
  }, [pathname, status, router]);

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
    setDetailsOpen(type !== "character");
    useGraphStore.getState().select([id]);
  };

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    const sync = async () => {
      const state = useGraphStore.getState();
      if (
        stopped ||
        document.visibilityState !== "visible" ||
        state.syncStatus === "syncing" ||
        state.status === "booting"
      )
        return;
      await state.forceSave();
      if (useGraphStore.getState().status !== "saved") return;
      await state.syncNow();
    };
    void (async () => {
      await useGraphStore.getState().boot();
      if (!getWorkspaceAccount() || stopped || !(await checkTursoConfigured())) return;
      await sync();
      if (!stopped) timer = setInterval(() => void sync(), 60_000);
    })();
    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
    };
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
      } else if (
        e.defaultPrevented ||
        (e.target instanceof HTMLElement &&
          e.target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]'))
      ) {
        // Text fields and the screenplay editor own their own undo history.
        return;
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

  const projectTitle = useGraphStore((s) =>
    s.projectId ? s.nodes[s.projectId]?.title : undefined,
  );

  return (
    <div className="tln-app" data-theme={theme}>
      <header className="tln-header">
        {/* Brand doubles as the way back to the shelf. Everything after it is
            story-specific and rendered only inside a story: undo, lenses, backup
            and a save indicator are all meaningless on a list of stories, and
            showing them there made the toolbar look broken rather than full. */}
        <button className="tln-brand" onClick={() => router.push("/stories")} title="All stories">
          <Logo />
        </button>

        {/* Top-level tabs, only outside a story — inside one, the header is
            already carrying that story's controls and a second row of
            navigation would compete with them. */}
        {section !== "story" && (
          <nav className="tln-nav" aria-label="Sections">
            {SECTIONS.map((sec) => (
              <button
                key={sec.id}
                aria-current={section === sec.id ? "page" : undefined}
                className={`tln-nav__tab${section === sec.id ? " tln-nav__tab--on" : ""}`}
                onClick={() => router.push(sec.href)}
              >
                {sec.icon}
                <span className="tln-nav__label">{sec.label}</span>
              </button>
            ))}
          </nav>
        )}

        <div className="tln-header__actions">
          <button
            className="tln-quick-search"
            onClick={() => setPaletteOpen(true)}
            aria-label="Quick search"
            aria-haspopup="dialog"
            aria-keyshortcuts="Control+k Meta+k"
            title="Quick search (Ctrl+K / ⌘K)"
          >
            <Search size={16} aria-hidden="true" />
            <span>Quick search</span>
            <kbd>⌘ / Ctrl K</kbd>
          </button>

          <button
            className="tln-tool tln-tool--theme"
            onClick={toggleTheme}
            title={
              theme === "dark"
                ? "Switch to Archival Print (Light)"
                : "Switch to Director's Studio (Dark)"
            }
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
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
                <circle cx="8" cy="8" r="3.2" />
                <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" />
              </svg>
            ) : (
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
                <path d="M13.5 9.5a5.5 5.5 0 1 1-7-7 4.5 4.5 0 0 0 7 7z" />
              </svg>
            )}
          </button>
          <Link
            href="/profile"
            className="tln-tool tln-tool--account"
            aria-label="Account"
            title="Your profile"
          >
            <UserRound size={16} aria-hidden="true" />
          </Link>
        </div>
      </header>

      {/* Boot failures used to be visible only inside a story, because that is
          where the status chip lives. On the shelf, the boneyard and research
          that meant a dead store presented as buttons that silently did nothing
          — which is precisely how it was reported. */}
      {status === "error" && (
        <div className="tln-fault" role="alert">
          <strong>Story Lane could not reach this browser&rsquo;s storage.</strong>{" "}
          {bootError ?? "Unknown error."} Nothing you do will be saved until this clears. If the app
          is open in another tab, close it and reload.
          <button className="tln-btn" onClick={() => location.reload()}>
            Reload
          </button>
        </div>
      )}

      {section === "boneyard" ? (
        <Suspense
          fallback={
            <div className="tln-workspace">
              <Loader kind="clap" label="Loading Boneyard…" />
            </div>
          }
        >
          <BoneyardView onGrown={(id) => router.push(`/stories/${id}`)} />
        </Suspense>
      ) : section === "research" ? (
        <Suspense
          fallback={
            <div className="tln-workspace">
              <Loader kind="clap" label="Loading Study Shelf…" />
            </div>
          }
        >
          <ResearchView />
        </Suspense>
      ) : level === "library" ? (
        <LibraryView onOpen={(id) => router.push(`/stories/${id}`)} />
      ) : (
        <>
          <div className="tln-story-bar">
            <div className="tln-story-bar__left">
              <nav className="tln-story-bar__crumbs" aria-label="Story navigation">
                <button className="tln-story-bar__crumb" onClick={() => router.push("/stories")}>
                  Stories
                </button>
                <span className="tln-story-bar__crumb-separator" aria-hidden="true">
                  /
                </span>
                <span className="tln-story-bar__title" title={projectTitle ?? ""}>
                  {projectTitle ?? ""}
                </span>
              </nav>

              <span className="tln-story-bar__divider" aria-hidden="true" />

              <div className="tln-story-bar__actions">
                <span className="tln-tools">
                  <button
                    className="tln-tool"
                    onClick={undo}
                    disabled={!canUndo}
                    title="Undo (Ctrl+Z)"
                    aria-label="Undo"
                  >
                    <svg
                      className="tln-tool__icon"
                      viewBox="0 0 16 16"
                      width="14"
                      height="14"
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
                    aria-label="Redo"
                  >
                    <svg
                      className="tln-tool__icon"
                      viewBox="0 0 16 16"
                      width="14"
                      height="14"
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

                <ScriptDownloads />

                <button
                  className="tln-tool"
                  onClick={() => setDiagnosticsOpen(true)}
                  title="Story Architecture & Health Diagnostics (powered by Effect)"
                  aria-label="Story Health Diagnostics"
                >
                  <Activity size={15} />
                </button>

                <button
                  className="tln-status"
                  onClick={() => router.push("/profile#sync")}
                  title={
                    syncMessage ??
                    `${SAVE_LABEL[status] ?? "Saved"} • Cloud: ${syncStatus}. View save and sync status in your profile.`
                  }
                  aria-label={
                    syncMessage ??
                    `${SAVE_LABEL[status] ?? "Saved on this device"}, cloud ${syncStatus}`
                  }
                >
                  <span className={`tln-status__part tln-status__local--${status}`}>
                    <i className="tln-status__dot" aria-hidden="true" />
                    <Laptop size={13} className="tln-status__device-icon" aria-hidden="true" />
                    <span className="sr-only">
                      {status === "error"
                        ? (useGraphStore.getState().bootError ?? "Save failed")
                        : SAVE_LABEL[status]}
                    </span>
                  </span>
                  <span
                    className={`tln-status__cloud tln-status__cloud--${syncStatus}`}
                    aria-hidden="true"
                  >
                    {syncStatus === "syncing" ? (
                      <RefreshCw size={12} className="tln-spin" />
                    ) : syncStatus === "synced" ? (
                      <CloudCheck size={13} />
                    ) : (
                      <Cloud size={13} />
                    )}
                  </span>
                </button>
              </div>
            </div>
            <div className="tln-story-bar__right">
              <span className="tln-lens-tabs" role="tablist" aria-label="Story lenses">
                {LENSES.map((l) => (
                  <button
                    key={l.id}
                    role="tab"
                    aria-selected={lens === l.id}
                    className={`tln-lens-tab${lens === l.id ? " tln-lens-tab--on" : ""}`}
                    onClick={() => {
                      setLens(l.id);
                      setDetailsOpen(false);
                    }}
                  >
                    {l.icon}
                    <span className="tln-lens-tab__label">{l.label}</span>
                  </button>
                ))}
              </span>
            </div>
          </div>
          <div className="tln-workspace">
            <StoryOrigins
              onOpen={(id) => router.push(`/boneyard?idea=${encodeURIComponent(id)}`)}
            />
            {lens !== "script" && lens !== "characters" && lens !== "timeline" && (
              <div className="tln-mobile-details-bar">
                <button
                  className="tln-btn"
                  aria-expanded={detailsOpen}
                  aria-controls="story-details"
                  onClick={() => setDetailsOpen((open) => !open)}
                >
                  {detailsOpen ? "Close details" : "Scene & connection details"}
                </button>
              </div>
            )}
            <div className="tln-workspace__lens">
              {lens === "map" ? (
                <Suspense
                  fallback={
                    <div className="tln-workspace">
                      <Loader kind="clap" label="Loading story map…" />
                    </div>
                  }
                >
                  <MapView />
                </Suspense>
              ) : null}
              {lens === "timeline" ? (
                <Suspense
                  fallback={
                    <div className="tln-workspace">
                      <Loader kind="clap" label="Loading sequence board…" />
                    </div>
                  }
                >
                  <TimelineView
                    onDetails={() => setDetailsOpen(true)}
                    onScript={() => setLens("script")}
                  />
                </Suspense>
              ) : null}
              {lens === "characters" ? (
                <Suspense
                  fallback={
                    <div className="tln-workspace">
                      <Loader kind="clap" label="Loading character dossiers…" />
                    </div>
                  }
                >
                  <CharactersView
                    onOpenNode={(id) => {
                      const type = useGraphStore.getState().nodes[id]?.type;
                      setLens(type === "scene" ? "script" : "map");
                      setDetailsOpen(type !== "scene");
                    }}
                  />
                </Suspense>
              ) : null}
              {lens === "script" ? (
                <Suspense
                  fallback={
                    <div className="tln-script">
                      <Loader kind="slug" />
                    </div>
                  }
                >
                  <ScriptView />
                </Suspense>
              ) : null}
            </div>
            {lens !== "script" && lens !== "characters" && lens !== "timeline" ? (
              <div id="story-details" className={`tln-dock${detailsOpen ? " tln-dock--open" : ""}`}>
                <Inspector />
                <ConnectionAdd />
              </div>
            ) : null}
          </div>
        </>
      )}
      {paletteOpen && (
        <Suspense fallback={null}>
          <Palette
            open={paletteOpen}
            onClose={() => setPaletteOpen(false)}
            onJump={jumpTo}
            onNavigate={(href) => router.push(href)}
          />
        </Suspense>
      )}
      {diagnosticsOpen && (
        <Suspense fallback={null}>
          <StoryDiagnosticsModal
            onClose={() => setDiagnosticsOpen(false)}
            onNavigateToNode={jumpTo}
          />
        </Suspense>
      )}
    </div>
  );
}
