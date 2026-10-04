import { usePathname, useRouter } from "next/navigation";
import { lazy, Suspense, useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useGraphStore } from "./store";
import { useWorkspaceTheme } from "./shell/useWorkspaceTheme";
import { type Lens } from "./shell/navigation";
import { AppHeader } from "./shell/AppHeader";
import { StoryBar } from "./shell/StoryBar";
import { useGlobalShortcuts } from "./shell/useGlobalShortcuts";
import { useAutoSync } from "./shell/useAutoSync";
import Loader from "./views/Loader";
import LibraryView from "./views/LibraryView";
import Inspector from "./views/Inspector";
import ConnectionAdd from "./views/ConnectionAdd";
import { StoryOrigins } from "./views/boneyard/StoryOrigins";

const MapView = lazy(() => import("./views/MapView"));
const TimelineView = lazy(() => import("./views/TimelineView"));
const CharactersView = lazy(() => import("./views/CharactersView"));
const BoneyardView = lazy(() => import("./views/BoneyardView"));
const ResearchView = lazy(() => import("./views/ResearchView"));
const ScriptView = lazy(() => import("./views/ScriptView"));
const Palette = lazy(() => import("./views/Palette"));
const StoryDiagnosticsModal = lazy(() => import("./views/StoryDiagnosticsModal"));

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
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { theme, toggleTheme } = useWorkspaceTheme();
  const router = useRouter();
  const pathname = usePathname();

  useAutoSync();

  useGlobalShortcuts({
    onSave: forceSave,
    onTogglePalette: () => setPaletteOpen((o) => !o),
    onUndo: undo,
    onRedo: redo,
  });

  const routeId = pathname.startsWith("/stories/")
    ? decodeURIComponent(pathname.slice("/stories/".length))
    : null;

  const section: "stories" | "boneyard" | "research" | "story" = routeId
    ? "story"
    : pathname.startsWith("/boneyard")
      ? "boneyard"
      : pathname.startsWith("/research")
        ? "research"
        : "stories";
  const level: "library" | "workspace" = routeId ? "workspace" : "library";

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

  const jumpTo = (id: string, type: string): void => {
    const pid = useGraphStore.getState().projectId;
    if (pid && !routeId) router.push(`/stories/${pid}`);
    if (type === "character") {
      setLens("characters");
      setDetailsOpen(false);
    } else if (lens !== "script" && lens !== "timeline") {
      setLens("map");
      setDetailsOpen(true);
    }
    useGraphStore.getState().select([id]);
  };

  const projectTitle = useGraphStore((s) =>
    s.projectId ? s.nodes[s.projectId]?.title : undefined,
  );

  return (
    <div className="tln-app" data-theme={theme}>
      <AppHeader
        section={section}
        theme={theme}
        status={status}
        bootError={bootError}
        toggleTheme={toggleTheme}
        onOpenPalette={() => setPaletteOpen(true)}
      />

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
          <StoryBar
            projectTitle={projectTitle}
            canUndo={canUndo}
            canRedo={canRedo}
            status={status}
            syncStatus={syncStatus}
            syncMessage={syncMessage}
            lens={lens}
            onUndo={undo}
            onRedo={redo}
            onOpenDiagnostics={() => setDiagnosticsOpen(true)}
            onSelectLens={(l) => {
              setLens(l);
              setDetailsOpen(false);
            }}
          />

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
                  <TimelineView onScript={() => setLens("script")} />
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
            onToggleTheme={toggleTheme}
            onOpenDiagnostics={() => setDiagnosticsOpen(true)}
            onSelectLens={(nextLens) => {
              setLens(nextLens);
              setDetailsOpen(false);
            }}
            onAddScene={() => {
              const pid = useGraphStore.getState().projectId;
              if (pid) {
                const newId = useGraphStore.getState().addNode({
                  type: "scene",
                  title: "New Scene",
                  parentId: pid,
                });
                jumpTo(newId, "scene");
              }
            }}
            onAddCharacter={() => {
              const pid = useGraphStore.getState().projectId;
              if (pid) {
                const newId = useGraphStore.getState().addNode({
                  type: "character",
                  title: "New Character",
                  parentId: pid,
                });
                jumpTo(newId, "character");
              }
            }}
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
