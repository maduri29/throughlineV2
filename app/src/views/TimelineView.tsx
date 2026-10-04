import { useGraphStore } from "../store";
import { SequenceGroupLane } from "./timeline/SequenceGroupLane";
import { SequenceSceneEditor } from "./timeline/SequenceSceneEditor";
import { useSequenceDragAndDrop } from "./timeline/useSequenceDragAndDrop";
import { useSequenceWorkspace } from "./timeline/useSequenceWorkspace";
import "./sequence-board.css";

export default function TimelineView({ onScript }: { onScript: () => void }) {
  const ws = useSequenceWorkspace();
  const dnd = useSequenceDragAndDrop();
  const state = useGraphStore.getState();

  if (!ws.project) return null;

  return (
    <section
      className={`sequence-board${ws.selected ? " has-editor" : ""}`}
      aria-label="Sequence board"
    >
      <header className="sequence-board__header">
        <div>
          <span className="sequence-board__eyebrow">PLAN YOUR STORY</span>
          <h2>
            Scene by scene<span>{ws.sequence.length}</span>
          </h2>
          <p>Shape the order. Find the turning points.</p>
        </div>
        <button
          className="sb-primary"
          onClick={() =>
            ws.add(
              ws.selectedGroup === ws.project?.id
                ? (ws.visibleGroups[0]?.id ?? ws.project.id)
                : ws.selectedGroup,
            )
          }
        >
          + Add scene
        </button>
      </header>

      <div className="sb-toolbar">
        <label className="sb-search">
          <span aria-hidden="true">⌕</span>
          <input
            aria-label="Find a scene"
            placeholder="Find a scene…"
            value={ws.query}
            onChange={(event) => ws.setQuery(event.target.value)}
          />
          {ws.query && (
            <button aria-label="Clear scene search" onClick={() => ws.setQuery("")}>
              ×
            </button>
          )}
        </label>
        <button
          className="sb-quiet"
          onClick={() => ws.setAddingGroup(!ws.addingGroup)}
          aria-expanded={ws.addingGroup}
        >
          + New sequence
        </button>
      </div>

      {ws.addingGroup && (
        <form
          className="sequence-board__new"
          onSubmit={(event) => {
            event.preventDefault();
            ws.createGroup();
          }}
        >
          <input
            autoFocus
            aria-label="New sequence name"
            placeholder="e.g. The discovery"
            value={ws.groupName}
            onChange={(event) => ws.setGroupName(event.target.value)}
            required
            maxLength={100}
          />
          <button className="sb-primary">Add sequence</button>
          <button type="button" className="sb-quiet" onClick={() => ws.setAddingGroup(false)}>
            Cancel
          </button>
        </form>
      )}

      <nav className="sb-filters" aria-label="Filter sequences">
        <button aria-pressed={ws.filter === "all"} onClick={() => ws.setFilter("all")}>
          All scenes <span>{ws.sequence.length}</span>
        </button>
        {ws.visibleGroups
          .filter((g) => g.id !== ws.project?.id)
          .map((g) => (
            <button key={g.id} aria-pressed={ws.filter === g.id} onClick={() => ws.setFilter(g.id)}>
              {g.title}
              <span>
                {ws.sequence.filter((item) => ws.groupFor(item.container) === g.id).length}
              </span>
            </button>
          ))}
      </nav>

      <div className="sb-workspace">
        <div className="sb-list">
          <div className="sb-list-caption">
            <span>STORY ORDER</span>
            <span>
              {ws.drafted} of {ws.sequence.length} scenes drafted
            </span>
          </div>

          {ws.matching.length === 0 &&
            ws.sequence.length > 0 &&
            (ws.query || ws.filter !== "all") && (
              <div className="sb-empty">
                <h3>No matching scenes</h3>
                <p>Try a different title or a few words from the outline.</p>
                <button
                  className="sb-quiet"
                  onClick={() => {
                    ws.setQuery("");
                    ws.setFilter("all");
                  }}
                >
                  Show all scenes
                </button>
              </div>
            )}

          <div className="sequence-board__groups">
            {ws.visibleGroups
              .filter((g) => ws.filter === "all" || ws.filter === g.id)
              .map((group, groupIndex) => {
                const items = ws.matching.filter(
                  (item) => ws.groupFor(item.container) === group.id,
                );
                if (ws.query && !items.length) return null;
                const isShut = ws.collapsed.includes(group.id) && !ws.query;

                return (
                  <SequenceGroupLane
                    key={group.id}
                    group={group}
                    groupIndex={groupIndex}
                    projectId={ws.project!.id}
                    isShut={isShut}
                    isUngrouped={group.id === ws.project!.id}
                    isSingleGroup={ws.groups.length === 1}
                    canMoveEarlier={ws.groups.indexOf(group) > 1}
                    canMoveLater={ws.groups.indexOf(group) < ws.groups.length - 1}
                    items={items}
                    sequence={ws.sequence}
                    selectedId={ws.selected?.id}
                    draggingId={dnd.dragging}
                    dropTargetId={dnd.dropTarget}
                    queryActive={Boolean(ws.query)}
                    nodes={ws.nodes}
                    edges={ws.edges}
                    onToggleCollapse={() =>
                      ws.setCollapsed((v) =>
                        isShut ? v.filter((id) => id !== group.id) : [...v, group.id],
                      )
                    }
                    onMoveGroup={(dir) => ws.moveGroup(group.id, dir)}
                    onRenameGroup={(title) => state.patchNode(group.id, { title })}
                    onSelectScene={(id) => state.select([id])}
                    onStartDrag={(id) => dnd.setDragging(id)}
                    onAddScene={() => ws.add(group.id)}
                    onDeleteGroup={(id) => {
                      state.deleteNodes([id]);
                      ws.setFilter("all");
                    }}
                  />
                );
              })}
          </div>
        </div>

        <SequenceSceneEditor
          selected={ws.selected}
          sceneNumber={
            ws.selected ? ws.sequence.findIndex((item) => item.scene.id === ws.selected!.id) + 1 : 0
          }
          groups={ws.groups}
          projectId={ws.project.id}
          selectedGroup={ws.selectedGroup}
          siblings={ws.siblings}
          selectedIndex={ws.selectedIndex}
          onClose={() => state.select([])}
          onScript={onScript}
          onPatch={(id, patch) => state.patchNode(id, patch)}
          onMoveScene={(sceneId, containerId, beforeId) =>
            state.moveScene(sceneId, containerId, beforeId)
          }
          onForceSave={() => state.forceSave()}
          onFilterChange={ws.setFilter}
          onDeleteScene={(id) => {
            state.deleteNodes([id]);
            state.select([]);
          }}
        />
      </div>
    </section>
  );
}
