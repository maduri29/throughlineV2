import type { GraphNode } from "../../types";

interface SequenceSceneEditorProps {
  selected: GraphNode | undefined;
  sceneNumber: number;
  groups: GraphNode[];
  projectId: string;
  selectedGroup: string;
  siblings: Array<{ scene: GraphNode; container: GraphNode | null }>;
  selectedIndex: number;
  onClose: () => void;
  onScript: () => void;
  onPatch: (id: string, patch: Partial<GraphNode>) => void;
  onMoveScene: (sceneId: string, containerId: string, beforeId?: string) => void;
  onForceSave: () => Promise<void>;
  onFilterChange: (f: string) => void;
}

export function SequenceSceneEditor({
  selected,
  sceneNumber,
  groups,
  projectId,
  selectedGroup,
  siblings,
  selectedIndex,
  onClose,
  onScript,
  onPatch,
  onMoveScene,
  onForceSave,
  onFilterChange,
}: SequenceSceneEditorProps) {
  if (!selected) {
    return (
      <aside className="sb-editor sb-editor--empty">
        <div>
          <span className="sb-empty-icon">✎</span>
          <h3>Make every scene count</h3>
          <p>
            Select a scene to shape its outline, find its turning point, or move it in the story.
          </p>
          <span>Drag the numbered grip to reorder.</span>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className="sb-editor"
      aria-label="Scene editor"
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
      key={selected.id}
    >
      <header>
        <div>
          <span className="sequence-board__eyebrow">
            SCENE {String(sceneNumber).padStart(2, "0")}
          </span>
          <h3>Shape this scene</h3>
        </div>
        <button className="sb-close" aria-label="Close scene editor" onClick={onClose}>
          ×
        </button>
      </header>
      <div className="sb-editor-body">
        <label>
          Scene title
          <input
            id="tln-inspector-title"
            defaultValue={selected.title}
            onBlur={(event) => {
              if (event.target.value !== selected.title) {
                onPatch(selected.id, { title: event.target.value });
              }
            }}
          />
        </label>
        <label>
          What happens?
          <textarea
            aria-label={`Outline for ${selected.title}`}
            defaultValue={selected.synopsis ?? ""}
            placeholder="The action, discovery or conflict that drives this scene."
            rows={5}
            onBlur={(event) => {
              if (event.target.value !== (selected.synopsis ?? "")) {
                onPatch(selected.id, { synopsis: event.target.value });
              }
            }}
          />
        </label>
        <label>
          What changes?
          <span className="sb-field-help">Give the scene a reason to be here.</span>
          <textarea
            aria-label={`Turning point for ${selected.title}`}
            defaultValue={selected.turningPoint ?? ""}
            placeholder="By the end of this scene…"
            rows={3}
            onBlur={(event) => {
              if (event.target.value !== (selected.turningPoint ?? "")) {
                onPatch(selected.id, { turningPoint: event.target.value });
              }
            }}
          />
        </label>
        <div className="sb-placement">
          <label>
            Sequence
            <select
              aria-label={`Sequence for ${selected.title}`}
              value={selectedGroup}
              onChange={(event) => {
                onMoveScene(selected.id, event.target.value);
                onFilterChange("all");
              }}
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.id === projectId ? "Ungrouped" : g.title}
                </option>
              ))}
            </select>
          </label>
          <div className="sb-move">
            <span>Position</span>
            <button
              disabled={selectedIndex === 0}
              aria-label={`Move ${selected.title} earlier`}
              onClick={() =>
                onMoveScene(selected.id, selectedGroup, siblings[selectedIndex - 1]?.scene.id)
              }
            >
              ↑ Earlier
            </button>
            <button
              disabled={selectedIndex === siblings.length - 1}
              aria-label={`Move ${selected.title} later`}
              onClick={() =>
                onMoveScene(selected.id, selectedGroup, siblings[selectedIndex + 2]?.scene.id)
              }
            >
              ↓ Later
            </button>
          </div>
        </div>
        <label className="sb-check">
          <input
            type="checkbox"
            checked={selected.needsWork ?? false}
            onChange={(event) => onPatch(selected.id, { needsWork: event.target.checked })}
          />
          Mark for another pass
        </label>
      </div>
      <footer>
        <button
          className="sb-quiet"
          onClick={() => {
            void onForceSave();
            onClose();
          }}
        >
          Save scene
        </button>
        <button className="sb-primary" onClick={onScript}>
          Open script ↗
        </button>
      </footer>
    </aside>
  );
}
