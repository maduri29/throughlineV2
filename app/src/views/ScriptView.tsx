// Script lens (T6 contract): split textarea + live preview, draggable 15–85%
// divider, collapsible preview, graph-owned locked slug, full-template
// skeletons with bracketed hints, whole-project .fountain export.
import { useMemo, useState } from "react";
import { Eye, ListOrdered, PenLine } from "lucide-react";
import {
  parseFountain,
  renderPreview,
  scriptSequence,
  skeletonBody,
  slugFor,
} from "../data/fountain";
import FountainEditor from "../editor/FountainEditor";
import { useGraphStore } from "../store";
import Loader from "./Loader";
import ScriptSequenceRail from "./script/ScriptSequenceRail";
import ScriptToolbar from "./script/ScriptToolbar";
import {
  getFontOption,
  loadScriptTypography,
  saveScriptTypography,
  type ScriptTypographyState,
} from "./script/scriptTypography";
import { useScriptBuffers } from "./script/useScriptBuffers";
import { useSplitPane } from "./script/useSplitPane";
import type { GraphNode } from "../types";
import "./script/script.css";

export default function ScriptView() {
  const nodeMap = useGraphStore((s) => s.nodes);
  const edgeMap = useGraphStore((s) => s.edges);
  const projectId = useGraphStore((s) => s.projectId);

  const [sceneId, setSceneId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"scenes" | "edit" | "preview">("edit");
  const [typography, setTypography] = useState<ScriptTypographyState>(() => loadScriptTypography());

  const handleTypographyChange = (next: ScriptTypographyState) => {
    setTypography(next);
    saveScriptTypography(next);
  };

  const project = projectId ? nodeMap[projectId] : undefined;
  const sequence = useMemo(
    () => (project ? scriptSequence(project, nodeMap, edgeMap) : []),
    [project, nodeMap, edgeMap],
  );

  const locationBySceneId = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of Object.values(edgeMap)) {
      if (e.type === "takes_place_at") {
        const title = nodeMap[e.to]?.title;
        if (title) map.set(e.from, title);
      }
    }
    return map;
  }, [nodeMap, edgeMap]);

  // Derived initial pick — no setState-in-effect cascade.
  const selectedId = useGraphStore((s) => s.selection[0]);
  const effectiveSceneId =
    sceneId ??
    (sequence.some((item) => item.scene.id === selectedId) ? selectedId : undefined) ??
    sequence[0]?.scene.id ??
    null;

  const { buffers, scheduleScene, flushScene } = useScriptBuffers(sceneId);
  const { splitPct, collapsed, setCollapsed, wrapRef, onDividerDown } = useSplitPane();

  const scene = effectiveSceneId ? nodeMap[effectiveSceneId] : undefined;
  const storedText = scene?.fountain?.trim() ? (scene.fountain ?? "") : "";
  const text =
    (effectiveSceneId ? buffers[effectiveSceneId] : undefined) ??
    (scene ? storedText || skeletonBody(scene) : "");

  const locationTitle =
    locationBySceneId.get(scene?.id ?? "") ??
    (scene?.title &&
    !scene.title.toLowerCase().startsWith("new scene") &&
    scene.title.toLowerCase() !== "untitled scene"
      ? scene.title
      : null);
  const slug = scene ? slugFor(scene, locationTitle) : "";
  const previewHtml = useMemo(() => renderPreview(parseFountain(text).els), [text]);

  const sceneIndex = sequence.findIndex((item) => item.scene.id === effectiveSceneId);
  const sceneNumber = sceneIndex >= 0 ? sceneIndex + 1 : undefined;

  const handleInsertCueSnippet = () => {
    if (!scene) return;
    const addition = text.trim() ? "\n\n@పాత్ర పేరు\nసంభాషణ ఇక్కడ రాయండి…" : "@పాత్ర పేరు\nసంభాషణ ఇక్కడ రాయండి…";
    scheduleScene(scene.id, text + addition);
  };

  const handleAddScene = () => {
    if (!project) return;
    const newId = useGraphStore.getState().addNode({
      type: "scene",
      title: "New Scene",
      parentId: project.id,
    });
    if (newId) {
      setSceneId(newId);
      setMobileTab("edit");
    }
  };

  const handlePatchScene = (patch: Partial<GraphNode>, locationName?: string) => {
    if (!scene) return;
    useGraphStore.getState().patchNode(scene.id, patch);
    if (locationName) {
      const locEdge = Object.values(edgeMap).find(
        (e) => e.type === "takes_place_at" && e.from === scene.id,
      );
      if (locEdge && nodeMap[locEdge.to]) {
        useGraphStore.getState().patchNode(locEdge.to, { title: locationName });
      }
    }
  };

  const currentFont = getFontOption(typography.fontId);
  const typoStyles = {
    "--font-script-family": currentFont.cssFamily,
    "--font-script-size": `${typography.fontSize}px`,
    "--font-script-line-height": typography.lineHeight,
  } as React.CSSProperties;

  if (!project)
    return (
      <div className="tln-script" style={typoStyles}>
        <Loader label="Opening script" />
      </div>
    );

  const mobileClass = `tln-script--mobile-${mobileTab}`;

  return (
    <div className={`tln-script ${mobileClass}`} style={typoStyles}>
      <nav className="tln-script__mobile-nav" aria-label="Script mobile navigation">
        <button
          type="button"
          className={`tln-script__mobile-tab${mobileTab === "scenes" ? " tln-script__mobile-tab--active" : ""}`}
          onClick={() => setMobileTab("scenes")}
          aria-pressed={mobileTab === "scenes"}
        >
          <ListOrdered size={14} aria-hidden="true" />
          <span>Scenes ({sequence.length})</span>
        </button>
        <button
          type="button"
          className={`tln-script__mobile-tab${mobileTab === "edit" ? " tln-script__mobile-tab--active" : ""}`}
          onClick={() => setMobileTab("edit")}
          aria-pressed={mobileTab === "edit"}
        >
          <PenLine size={14} aria-hidden="true" />
          <span>Write</span>
        </button>
        <button
          type="button"
          className={`tln-script__mobile-tab${mobileTab === "preview" ? " tln-script__mobile-tab--active" : ""}`}
          onClick={() => setMobileTab("preview")}
          aria-pressed={mobileTab === "preview"}
        >
          <Eye size={14} aria-hidden="true" />
          <span>Preview</span>
        </button>
      </nav>

      <ScriptSequenceRail
        sequence={sequence}
        effectiveSceneId={effectiveSceneId}
        locationBySceneId={locationBySceneId}
        onSelectScene={(id) => {
          setSceneId(id);
          setMobileTab("edit");
        }}
        onAddScene={handleAddScene}
      />

      <div className="tln-script__main" ref={wrapRef}>
        <div
          className="tln-script__edit"
          style={{ flexBasis: collapsed ? "100%" : `${splitPct}%` }}
        >
          <ScriptToolbar
            slug={slug}
            scene={scene}
            onPatchScene={handlePatchScene}
            typography={typography}
            onTypographyChange={handleTypographyChange}
            onInsertCueSnippet={handleInsertCueSnippet}
            sceneNumber={sceneNumber}
            totalScenes={sequence.length}
            onOpenMobileScenes={() => setMobileTab("scenes")}
          />

          {scene ? (
            <FountainEditor
              className="tln-script__ta"
              value={text}
              onChange={(v) => scheduleScene(scene.id, v)}
              onBlur={() => flushScene(scene.id)}
            />
          ) : (
            <div className="tln-script__empty">Select a scene on the left.</div>
          )}
        </div>

        {!collapsed ? (
          <>
            <div className="tln-script__divider" onMouseDown={onDividerDown} />
            <div
              className="tln-script__preview"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </>
        ) : null}

        <button
          className="tln-script__collapse"
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? "Show preview" : "Hide preview"}
          aria-label={collapsed ? "Show script preview" : "Hide script preview"}
        >
          {collapsed ? "◀" : "▶"}
        </button>
      </div>
    </div>
  );
}
