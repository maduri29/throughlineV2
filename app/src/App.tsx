import { usePathname, useRouter } from "next/navigation";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useGraphStore } from "./store";
import BoneyardView from "./views/BoneyardView";
import Logo from "./views/Logo";
import ResearchView from "./views/ResearchView";
import MapView from "./views/MapView";
import TimelineView from "./views/TimelineView";
import CharactersView from "./views/CharactersView";
import LibraryView from "./views/LibraryView";
import Inspector from "./views/Inspector";
import ConnectionAdd from "./views/ConnectionAdd";

const ScriptView = lazy(() => import("./views/ScriptView"));
const Palette = lazy(() => import("./views/Palette"));
const SyncModal = lazy(() => import("./views/SyncModal"));

const SAVE_LABEL: Record<string, string> = {
  booting: "Loading…",
  saved: "Saved on this device",
  saving: "Saving…",
  dirty: "Unsaved edits",
  error: "Save failed — retry with Ctrl+S",
};

type Lens = "map" | "timeline" | "characters" | "script";

const LENSES = [
  {
    id: "map" as Lens,
    label: "Map",
    icon: (
      <svg
        className="tln-lens-tab__icon"
        viewBox="0 0 16 16"
        width="13"
        height="13"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="3.5" cy="4" r="1.75" />
        <circle cx="12.5" cy="5" r="1.75" />
        <circle cx="8" cy="12.5" r="1.75" />
        <path d="M5.2 4.2l5.6.7M4.6 5.5l2.4 5.6M11.4 6.5l-2.4 4.6" />
      </svg>
    ),
  },
  {
    id: "timeline" as Lens,
    label: "Timeline",
    icon: (
      <svg
        className="tln-lens-tab__icon"
        viewBox="0 0 16 16"
        width="13"
        height="13"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="2" y="3" width="12" height="10.5" rx="2" />
        <path d="M5 1.5v3M11 1.5v3M2 7h12M5 10h1.5M9.5 10H11" />
      </svg>
    ),
  },
  {
    id: "characters" as Lens,
    label: "Characters",
    icon: (
      <svg
        className="tln-lens-tab__icon"
        viewBox="0 0 16 16"
        width="13"
        height="13"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="8" cy="5" r="2.75" />
        <path d="M3 14a5 5 0 0 1 10 0" />
      </svg>
    ),
  },
  {
    id: "script" as Lens,
    label: "Script",
    icon: (
      <svg
        className="tln-lens-tab__icon"
        viewBox="0 0 16 16"
        width="13"
        height="13"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3.5 2.5h6l3.5 3.5v7.5a1 1 0 0 1-1 1h-8.5a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1z" />
        <path d="M9.5 2.5v3.5h3.5M5.5 8.5h5M5.5 11h3" />
      </svg>
    ),
  },
];

const SECTIONS = [
  {
    id: "stories" as const,
    label: "Stories",
    href: "/stories",
    icon: (
      <svg
        className="tln-nav__icon"
        viewBox="0 0 16 16"
        width="13"
        height="13"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="2.5" y="2.5" width="11" height="11" rx="2" />
        <path d="M2.5 6.5h11M6 2.5v4M10 2.5v4" />
      </svg>
    ),
  },
  {
    id: "boneyard" as const,
    label: "Boneyard",
    href: "/boneyard",
    icon: (
      <svg
        className="tln-nav__icon"
        viewBox="0 0 16 16"
        width="13"
        height="13"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M8.5 1.5L3.5 9h4.5l-1 5.5 6-8h-4.5z" />
      </svg>
    ),
  },
  {
    id: "research" as const,
    label: "Research",
    href: "/research",
    icon: (
      <svg
        className="tln-nav__icon"
        viewBox="0 0 16 16"
        width="13"
        height="13"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="7" cy="7" r="4.5" />
        <path d="m10.5 10.5 3.5 3.5" />
      </svg>
    ),
  },
];

export default function App() {
  const {
    status,
    canUndo,
    canRedo,
    undo,
    redo,
    forceSave,
    exportProject,
    projectId,
    bootError,
    syncStatus,
    syncMessage,
  } = useGraphStore(
    useShallow((s) => ({
      status: s.status,
      canUndo: s.canUndo,
      canRedo: s.canRedo,
      undo: s.undo,
      redo: s.redo,
      forceSave: s.forceSave,
      exportProject: s.exportProject,
      projectId: s.projectId,
      bootError: s.bootError,
      syncStatus: s.syncStatus,
      syncMessage: s.syncMessage,
    })),
  );
  const [syncOpen, setSyncOpen] = useState(false);
  const [lens, setLens] = useState<Lens>("map");
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "dark";
    const saved = localStorage.getItem("throughline:theme") as "dark" | "light" | null;
    return saved ?? (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
  });
  const router = useRouter();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((curr) => {
      const next = curr === "dark" ? "light" : "dark";
      localStorage.setItem("throughline:theme", next);
      return next;
    });
  }, []);
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
    useGraphStore.getState().select([id]);
  };

  useEffect(() => {
    void useGraphStore.getState().boot();
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
    <div className="tln-app" data-theme={theme}>
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
          <nav className="tln-nav" aria-label="Sections">
            {SECTIONS.map((sec) => (
              <button
                key={sec.id}
                className={`tln-nav__tab${section === sec.id ? " tln-nav__tab--on" : ""}`}
                onClick={() => router.push(sec.href)}
              >
                {sec.icon}
                <span className="tln-nav__label">{sec.label}</span>
              </button>
            ))}
          </nav>
        )}

        <span className="tln-header__gap" />

        <button
          className="tln-sync-btn"
          onClick={() => setSyncOpen(true)}
          title={syncMessage ?? "Cross-device cloud sync (Turso)"}
          aria-label="Cloud sync"
        >
          <span className={`tln-sync-icon tln-sync-icon--${syncStatus}`}>
            {syncStatus === "syncing" ? "⟳" : "☁"}
          </span>
          <span className="tln-sync-label">
            {syncStatus === "syncing" ? "Syncing…" : syncStatus === "synced" ? "Synced" : "Sync"}
          </span>
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

            {/* One indicator again. It reported two guarantees while there was a
                cloud to report on; there is only this device now, and saying so
                twice would be theatre. */}
            <span className="tln-status">
              <span className={`tln-status__part tln-status__local--${status}`}>
                <i className="tln-status__dot" aria-hidden="true" />
                {status === "error"
                  ? (useGraphStore.getState().bootError ?? "Save failed")
                  : SAVE_LABEL[status]}
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

            <span className="tln-lens-tabs" role="tablist" aria-label="Story lenses">
              {LENSES.map((l) => (
                <button
                  key={l.id}
                  role="tab"
                  aria-selected={lens === l.id}
                  className={`tln-lens-tab${lens === l.id ? " tln-lens-tab--on" : ""}`}
                  onClick={() => setLens(l.id)}
                >
                  {l.icon}
                  <span className="tln-lens-tab__label">{l.label}</span>
                </button>
              ))}
            </span>
          </>
        )}
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
        <LibraryView onOpen={(id) => router.push(`/stories/${id}`)} />
      ) : (
        <div className="tln-workspace">
          <div className="tln-workspace__lens">
            {lens === "map" ? <MapView /> : null}
            {lens === "timeline" ? <TimelineView /> : null}
            {lens === "characters" ? <CharactersView /> : null}
            {lens === "script" ? (
              <Suspense
                fallback={
                  <div className="tln-script">
                    <div className="tln-boot">Loading editor…</div>
                  </div>
                }
              >
                <ScriptView />
              </Suspense>
            ) : null}
          </div>
          {lens !== "script" && lens !== "characters" ? (
            <div className="tln-dock">
              <Inspector />
              <ConnectionAdd />
            </div>
          ) : null}
        </div>
      )}
      {paletteOpen && (
        <Suspense fallback={null}>
          <Palette open={paletteOpen} onClose={() => setPaletteOpen(false)} onJump={jumpTo} />
        </Suspense>
      )}
      {syncOpen && (
        <Suspense fallback={null}>
          <SyncModal onClose={() => setSyncOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}
