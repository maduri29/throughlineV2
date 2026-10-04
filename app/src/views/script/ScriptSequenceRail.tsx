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
};

export default function ScriptSequenceRail({
  sequence,
  effectiveSceneId,
  locationBySceneId,
  onSelectScene,
}: ScriptSequenceRailProps) {
  return (
    <aside className="tln-script__rail">
      <div className="tln-script__railhead">SCRIPT ORDER</div>
      {sequence.map(({ container, scene: sc }) => (
        <button
          key={sc.id}
          className={`tln-script__item${sc.id === effectiveSceneId ? " tln-script__item--on" : ""}`}
          onClick={() => onSelectScene(sc.id)}
          title={slugFor(sc, locationBySceneId.get(sc.id) ?? null)}
        >
          <span className="tln-script__ep">{container ? container.title : "—"}</span>
          <span className="tln-script__ttl">
            {(sc.storyTime?.storyDay ?? 0) < 0 ? "⟲ " : ""}
            {sc.title}
          </span>
        </button>
      ))}
    </aside>
  );
}
