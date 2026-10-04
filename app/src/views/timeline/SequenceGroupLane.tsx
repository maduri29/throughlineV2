import type React from "react";
import type { GraphEdge, GraphNode } from "../../types";
import { locationTitleFor } from "../../data/fountain";
import { SequenceSceneCard } from "./SequenceSceneCard";

interface SequenceGroupLaneProps {
  group: GraphNode;
  groupIndex: number;
  projectId: string;
  isShut: boolean;
  isUngrouped: boolean;
  isSingleGroup: boolean;
  canMoveEarlier: boolean;
  canMoveLater: boolean;
  items: Array<{ scene: GraphNode; container: GraphNode | null }>;
  sequence: Array<{ scene: GraphNode; container: GraphNode | null }>;
  selectedId?: string;
  draggingId?: string | null;
  dropTargetId?: string | null;
  queryActive: boolean;
  nodes: Record<string, GraphNode>;
  edges: Record<string, GraphEdge>;
  onToggleCollapse: () => void;
  onMoveGroup: (direction: number) => void;
  onRenameGroup: (title: string) => void;
  onSelectScene: (id: string) => void;
  onStartDrag: (id: string) => void;
  onAddScene: () => void;
}

export function SequenceGroupLane({
  group,
  groupIndex,
  isShut,
  isUngrouped,
  isSingleGroup,
  canMoveEarlier,
  canMoveLater,
  items,
  sequence,
  selectedId,
  draggingId,
  dropTargetId,
  queryActive,
  nodes,
  edges,
  onToggleCollapse,
  onMoveGroup,
  onRenameGroup,
  onSelectScene,
  onStartDrag,
  onAddScene,
}: SequenceGroupLaneProps) {
  const color = ["#54958b", "#af8860", "#8c82b7", "#5b8faf"][groupIndex % 4];

  return (
    <section
      className="sequence-board__group"
      data-sequence-id={group.id}
      aria-label={isUngrouped ? "Ungrouped scenes" : group.title}
      style={{ "--sequence-color": color } as React.CSSProperties}
    >
      <header>
        <button
          className="sb-collapse"
          aria-label={`${isShut ? "Expand" : "Collapse"} ${group.title}`}
          aria-expanded={!isShut}
          onClick={onToggleCollapse}
        >
          {isShut ? "▸" : "▾"}
        </button>
        {isUngrouped ? (
          <h3>{isSingleGroup ? "Your scenes" : "Ungrouped"}</h3>
        ) : (
          <input
            aria-label={`Sequence name: ${group.title}`}
            value={group.title}
            onChange={(event) => onRenameGroup(event.target.value)}
          />
        )}
        <span>{items.length}</span>
        <details className="sb-sequence-menu">
          <summary aria-label={`Options for ${group.title}`}>···</summary>
          <div>
            <button disabled={!canMoveEarlier} onClick={() => onMoveGroup(-1)}>
              Move sequence earlier
            </button>
            <button disabled={!canMoveLater} onClick={() => onMoveGroup(1)}>
              Move sequence later
            </button>
          </div>
        </details>
      </header>

      {!isShut && (
        <>
          <ol>
            {items.map(({ scene }) => {
              const number = sequence.findIndex((item) => item.scene.id === scene.id) + 1;
              const location = [locationTitleFor(scene.id, nodes, edges), scene.storyTime?.tod]
                .filter(Boolean)
                .join(" · ");

              return (
                <SequenceSceneCard
                  key={scene.id}
                  scene={scene}
                  number={number}
                  isSelected={selectedId === scene.id}
                  isDragging={draggingId === scene.id}
                  isDropTarget={dropTargetId === scene.id && draggingId !== scene.id}
                  location={location}
                  queryActive={queryActive}
                  onSelect={() => onSelectScene(scene.id)}
                  onStartDrag={() => onStartDrag(scene.id)}
                />
              );
            })}
          </ol>
          <button className="sequence-board__add" onClick={onAddScene}>
            + Add scene
          </button>
          {items.length === 0 && (
            <p className="sb-empty-sequence">Start with a moment, a conflict, or a discovery.</p>
          )}
        </>
      )}
    </section>
  );
}
