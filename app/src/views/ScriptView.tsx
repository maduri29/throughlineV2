// Script lens (T6 contract): split textarea + live preview, draggable 15–85%
// divider, collapsible preview, graph-owned locked slug, full-template
// skeletons with bracketed hints, whole-project .fountain export.
import { useMemo, useState } from "react";
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
import "./script/script.css";

export default function ScriptView() {
  const nodeMap = useGraphStore((s) => s.nodes);
  const edgeMap = useGraphStore((s) => s.edges);
  const projectId = useGraphStore((s) => s.projectId);

  const [sceneId, setSceneId] = useState<string | null>(null);
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
  const slug = scene ? slugFor(scene, locationBySceneId.get(scene.id) ?? null) : "";
  const previewHtml = useMemo(() => renderPreview(parseFountain(text).els), [text]);

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
    if (newId) setSceneId(newId);
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

  return (
    <div className="tln-script" style={typoStyles}>
      <ScriptSequenceRail
        sequence={sequence}
        effectiveSceneId={effectiveSceneId}
        locationBySceneId={locationBySceneId}
        onSelectScene={setSceneId}
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
            onPatchScene={(patch) => {
              if (scene) useGraphStore.getState().patchNode(scene.id, patch);
            }}
            typography={typography}
            onTypographyChange={handleTypographyChange}
            onInsertCueSnippet={handleInsertCueSnippet}
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
        >
          {collapsed ? "◀" : "▶"}
        </button>
      </div>
    </div>
  );
}
