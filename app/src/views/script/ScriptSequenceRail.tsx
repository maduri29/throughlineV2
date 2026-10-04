import { Plus } from "lucide-react";
import { slugFor } from "../../data/fountain";
import type { GraphNode } from "../../types";

type SequenceItem = {
  container: GraphNode | null;
  scene: GraphNode;
};

type ScriptSequenceRailProps = {
  sequence: SequenceItem[];
  effectiveSceneId: string | null;
  locationBySceneId: Map<string, string>;
  onSelectScene: (id: string) => void;
  onAddScene?: () => void;
};

export default function ScriptSequenceRail({
  sequence,
  effectiveSceneId,
  locationBySceneId,
  onSelectScene,
  onAddScene,
}: ScriptSequenceRailProps) {
  return (
    <aside className="tln-script__rail" aria-label="Script scenes order">
      <div className="tln-script__railhead">SCRIPT ORDER ({sequence.length})</div>
      {sequence.map(({ container, scene: sc }) => {
        const isSelected = sc.id === effectiveSceneId;
        const locTitle =
          locationBySceneId.get(sc.id) ??
          (sc.title &&
          !sc.title.toLowerCase().startsWith("new scene") &&
          sc.title.toLowerCase() !== "untitled scene"
            ? sc.title
            : null);
        const itemSlug = slugFor(sc, locTitle);

        return (
          <button
            key={sc.id}
            type="button"
            className={`tln-script__item${isSelected ? " tln-script__item--on" : ""}`}
            onClick={() => onSelectScene(sc.id)}
            title={itemSlug}
            aria-current={isSelected ? "true" : undefined}
          >
            <span className="tln-script__ep">{container ? container.title : "—"}</span>
            <span className="tln-script__ttl">
              {(sc.storyTime?.storyDay ?? 0) < 0 ? "⟲ " : ""}
              {sc.title}
            </span>
          </button>
        );
      })}
      {onAddScene && (
        <button
          type="button"
          className="tln-script__add-btn"
          onClick={onAddScene}
          title="Add a new scene"
        >
          <Plus size={13} aria-hidden="true" />
          <span>Add scene</span>
        </button>
      )}
    </aside>
  );
}
