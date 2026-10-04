import type { GraphNode } from "../../types";

interface SequenceSceneCardProps {
  scene: GraphNode;
  number: number;
  isSelected: boolean;
  isDragging: boolean;
  isDropTarget: boolean;
  location?: string;
  queryActive: boolean;
  onSelect: () => void;
  onStartDrag: () => void;
}

export function SequenceSceneCard({
  scene,
  number,
  isSelected,
  isDragging,
  isDropTarget,
  location,
  queryActive,
  onSelect,
  onStartDrag,
}: SequenceSceneCardProps) {
  return (
    <li
      className={`sequence-board__card${isSelected ? " is-selected" : ""}${isDragging ? " is-dragging" : ""}${isDropTarget ? " is-drop-target" : ""}`}
      data-scene-id={scene.id}
    >
      <span
        className="sequence-board__number"
        title="Drag to reorder"
        onPointerDown={(event) => {
          if (event.button !== 0 || queryActive) return;
          event.preventDefault();
          onStartDrag();
        }}
      >
        <span aria-hidden="true">⠿</span>
        {String(number).padStart(2, "0")}
      </span>
      <button
        className="sb-scene"
        aria-label={scene.title}
        aria-pressed={isSelected}
        onClick={onSelect}
      >
        <span className="sb-scene-top">
          <strong className="sequence-board__title">{scene.title}</strong>
          <span
            className={`sb-status${scene.needsWork ? " needs-work" : scene.fountain?.trim() ? " drafted" : ""}`}
          >
            {scene.needsWork ? "Needs work" : scene.fountain?.trim() ? "Drafted" : "Outline"}
          </span>
        </span>
        <span className={`sequence-board__synopsis${scene.synopsis ? "" : " is-empty"}`}>
          {scene.synopsis || "Add what happens in this scene"}
        </span>
        {scene.turningPoint && <span className="sequence-board__turn">↳ {scene.turningPoint}</span>}
        {location && <span className="sequence-board__location">{location}</span>}
      </button>
      <span className="sb-chevron" aria-hidden="true">
        ›
      </span>
    </li>
  );
}
