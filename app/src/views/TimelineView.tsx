import type { GraphNode } from "../types";
import { useEffect, useState } from "react";
import { useGraphStore } from "../store";
import { locationTitleFor, scriptSequence } from "../data/fountain";
import "./sequence-board.css";

export default function TimelineView({
  onScript,
}: {
  onDetails: () => void;
  onScript: () => void;
}) {
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const projectId = useGraphStore((s) => s.projectId);
  const selection = useGraphStore((s) => s.selection);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");
  const [addingGroup, setAddingGroup] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [collapsed, setCollapsed] = useState<string[]>([]);
  useEffect(() => {
    if (!dragging) return;
    const move = (event: PointerEvent) => {
      const card = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>("[data-scene-id]");
      setDropTarget(card?.dataset.sceneId ?? null);
    };
    const finish = (event: PointerEvent) => {
      const element = document.elementFromPoint(event.clientX, event.clientY);
      const card = element?.closest<HTMLElement>("[data-scene-id]");
      const section = element?.closest<HTMLElement>("[data-sequence-id]");
      if (section?.dataset.sequenceId)
        useGraphStore
          .getState()
          .moveScene(dragging, section.dataset.sequenceId, card?.dataset.sceneId);
      setDragging(null);
      setDropTarget(null);
    };
    const cancel = () => {
      setDragging(null);
      setDropTarget(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", cancel);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", cancel);
    };
  }, [dragging]);
  const project = projectId ? nodes[projectId] : undefined;
  if (!project) return null;
  const state = useGraphStore.getState();
  const sequence = scriptSequence(project, nodes, edges);
  const groups = [
    project,
    ...(project.order ?? [])
      .map((id) => nodes[id])
      .filter((n): n is GraphNode => n?.type === "episode"),
  ];
  const groupFor = (container: GraphNode | null) =>
    container?.type === "episode" ? container.id : project.id;
  const visibleGroups = groups.filter(
    (g) =>
      g.id !== project.id ||
      groups.length === 1 ||
      sequence.some((item) => groupFor(item.container) === project.id),
  );
  const drafted = sequence.filter((item) => item.scene.fountain?.trim()).length;
  const moveGroup = (id: string, direction: number) => {
    const ordered = groups.slice(1);
    const index = ordered.findIndex((g) => g.id === id);
    if (index < 0) return;
    const other = ordered[index + direction];
    if (!other) return;
    const order = [...(project.order ?? [])];
    const a = order.indexOf(id),
      b = order.indexOf(other.id);
    [order[a], order[b]] = [order[b]!, order[a]!];
    state.setOrder(project.id, order);
  };
  const chosen = sequence.find((item) => selection.includes(item.scene.id));
  const selected = chosen?.scene;
  const selectedGroup = chosen ? groupFor(chosen.container) : project.id;
  const siblings = sequence.filter((item) => groupFor(item.container) === selectedGroup);
  const selectedIndex = siblings.findIndex((item) => item.scene.id === selected?.id);
  const matching = sequence.filter(
    (item) =>
      (filter === "all" || groupFor(item.container) === filter) &&
      `${item.scene.title} ${item.scene.synopsis ?? ""} ${item.scene.turningPoint ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const add = (groupId: string) => {
    setQuery("");
    setFilter("all");
    setCollapsed((v) => v.filter((id) => id !== groupId));
    state.addScene(groupId);
  };
  return (
    <section
      className={`sequence-board${selected ? " has-editor" : ""}`}
      aria-label="Sequence board"
    >
      <header className="sequence-board__header">
        <div>
          <span className="sequence-board__eyebrow">PLAN YOUR STORY</span>
          <h2>
            Scene by scene<span>{sequence.length}</span>
          </h2>
          <p>Shape the order. Find the turning points.</p>
        </div>
        <button
          className="sb-primary"
          onClick={() =>
            add(selectedGroup === project.id ? (visibleGroups[0]?.id ?? project.id) : selectedGroup)
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
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button aria-label="Clear scene search" onClick={() => setQuery("")}>
              ×
            </button>
          )}
        </label>
        <button
          className="sb-quiet"
          onClick={() => setAddingGroup(!addingGroup)}
          aria-expanded={addingGroup}
        >
          + New sequence
        </button>
      </div>
      {addingGroup && (
        <form
          className="sequence-board__new"
          onSubmit={(event) => {
            event.preventDefault();
            if (!groupName.trim()) return;
            state.addNodeOfType("episode", groupName.trim());
            setGroupName("");
            setAddingGroup(false);
            setFilter("all");
          }}
        >
          <input
            autoFocus
            aria-label="New sequence name"
            placeholder="e.g. The discovery"
            value={groupName}
            onChange={(event) => setGroupName(event.target.value)}
            required
            maxLength={100}
          />
          <button className="sb-primary">Add sequence</button>
          <button type="button" className="sb-quiet" onClick={() => setAddingGroup(false)}>
            Cancel
          </button>
        </form>
      )}
      <nav className="sb-filters" aria-label="Filter sequences">
        <button aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
          All scenes <span>{sequence.length}</span>
        </button>
        {visibleGroups
          .filter((g) => g.id !== project.id)
          .map((g) => (
            <button key={g.id} aria-pressed={filter === g.id} onClick={() => setFilter(g.id)}>
              {g.title}
              <span>{sequence.filter((item) => groupFor(item.container) === g.id).length}</span>
            </button>
          ))}
      </nav>
      <div className="sb-workspace">
        <div className="sb-list">
          <div className="sb-list-caption">
            <span>STORY ORDER</span>
            <span>
              {drafted} of {sequence.length} scenes drafted
            </span>
          </div>
          {matching.length === 0 && sequence.length > 0 && (query || filter !== "all") && (
            <div className="sb-empty">
              <h3>No matching scenes</h3>
              <p>Try a different title or a few words from the outline.</p>
              <button
                className="sb-quiet"
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                }}
              >
                Show all scenes
              </button>
            </div>
          )}
          <div className="sequence-board__groups">
            {visibleGroups
              .filter((g) => filter === "all" || filter === g.id)
              .map((group, groupIndex) => {
                const items = matching.filter((item) => groupFor(item.container) === group.id);
                if (query && !items.length) return null;
                const shut = collapsed.includes(group.id) && !query;
                return (
                  <section
                    className="sequence-board__group"
                    data-sequence-id={group.id}
                    key={group.id}
                    aria-label={group.id === project.id ? "Ungrouped scenes" : group.title}
                    style={
                      {
                        "--sequence-color": ["#54958b", "#af8860", "#8c82b7", "#5b8faf"][
                          groupIndex % 4
                        ],
                      } as React.CSSProperties
                    }
                  >
                    <header>
                      <button
                        className="sb-collapse"
                        aria-label={`${shut ? "Expand" : "Collapse"} ${group.title}`}
                        aria-expanded={!shut}
                        onClick={() =>
                          setCollapsed((v) =>
                            shut ? v.filter((id) => id !== group.id) : [...v, group.id],
                          )
                        }
                      >
                        {shut ? "▸" : "▾"}
                      </button>
                      {group.id === project.id ? (
                        <h3>{groups.length === 1 ? "Your scenes" : "Ungrouped"}</h3>
                      ) : (
                        <input
                          aria-label={`Sequence name: ${group.title}`}
                          value={group.title}
                          onChange={(event) =>
                            state.patchNode(group.id, { title: event.target.value })
                          }
                        />
                      )}
                      <span>{items.length}</span>
                      <details className="sb-sequence-menu">
                        <summary aria-label={`Options for ${group.title}`}>···</summary>
                        <div>
                          <button
                            disabled={groups.indexOf(group) <= 1}
                            onClick={() => moveGroup(group.id, -1)}
                          >
                            Move sequence earlier
                          </button>
                          <button
                            disabled={groups.indexOf(group) === groups.length - 1}
                            onClick={() => moveGroup(group.id, 1)}
                          >
                            Move sequence later
                          </button>
                        </div>
                      </details>
                    </header>
                    {!shut && (
                      <>
                        <ol>
                          {items.map(({ scene }) => {
                            const number =
                              sequence.findIndex((item) => item.scene.id === scene.id) + 1;
                            const location = [
                              locationTitleFor(scene.id, nodes, edges),
                              scene.storyTime?.tod,
                            ]
                              .filter(Boolean)
                              .join(" · ");
                            return (
                              <li
                                className={`sequence-board__card${selected?.id === scene.id ? " is-selected" : ""}${dragging === scene.id ? " is-dragging" : ""}${dropTarget === scene.id && dragging !== scene.id ? " is-drop-target" : ""}`}
                                key={scene.id}
                                data-scene-id={scene.id}
                              >
                                <span
                                  className="sequence-board__number"
                                  title="Drag to reorder"
                                  onPointerDown={(event) => {
                                    if (event.button !== 0 || query) return;
                                    event.preventDefault();
                                    setDragging(scene.id);
                                  }}
                                >
                                  <span aria-hidden="true">⠿</span>
                                  {String(number).padStart(2, "0")}
                                </span>
                                <button
                                  className="sb-scene"
                                  aria-label={scene.title}
                                  aria-pressed={selected?.id === scene.id}
                                  onClick={() => state.select([scene.id])}
                                >
                                  <span className="sb-scene-top">
                                    <strong className="sequence-board__title">{scene.title}</strong>
                                    <span
                                      className={`sb-status${scene.needsWork ? " needs-work" : scene.fountain?.trim() ? " drafted" : ""}`}
                                    >
                                      {scene.needsWork
                                        ? "Needs work"
                                        : scene.fountain?.trim()
                                          ? "Drafted"
                                          : "Outline"}
                                    </span>
                                  </span>
                                  <span
                                    className={`sequence-board__synopsis${scene.synopsis ? "" : " is-empty"}`}
                                  >
                                    {scene.synopsis || "Add what happens in this scene"}
                                  </span>
                                  {scene.turningPoint && (
                                    <span className="sequence-board__turn">
                                      ↳ {scene.turningPoint}
                                    </span>
                                  )}
                                  {location && (
                                    <span className="sequence-board__location">{location}</span>
                                  )}
                                </button>
                                <span className="sb-chevron" aria-hidden="true">
                                  ›
                                </span>
                              </li>
                            );
                          })}
                        </ol>
                        <button className="sequence-board__add" onClick={() => add(group.id)}>
                          + Add scene
                        </button>
                        {!items.length && (
                          <p className="sb-empty-sequence">
                            Start with a moment, a conflict, or a discovery.
                          </p>
                        )}
                      </>
                    )}
                  </section>
                );
              })}
          </div>
        </div>
        {selected ? (
          <aside
            className="sb-editor"
            aria-label="Scene editor"
            onKeyDown={(event) => {
              if (event.key === "Escape") state.select([]);
            }}
            key={selected.id}
          >
            <header>
              <div>
                <span className="sequence-board__eyebrow">
                  SCENE{" "}
                  {String(sequence.findIndex((item) => item.scene.id === selected.id) + 1).padStart(
                    2,
                    "0",
                  )}
                </span>
                <h3>Shape this scene</h3>
              </div>
              <button
                className="sb-close"
                aria-label="Close scene editor"
                onClick={() => state.select([])}
              >
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
                    if (event.target.value !== selected.title)
                      state.patchNode(selected.id, { title: event.target.value });
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
                    if (event.target.value !== (selected.synopsis ?? ""))
                      state.patchNode(selected.id, { synopsis: event.target.value });
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
                    if (event.target.value !== (selected.turningPoint ?? ""))
                      state.patchNode(selected.id, { turningPoint: event.target.value });
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
                      state.moveScene(selected.id, event.target.value);
                      setFilter("all");
                    }}
                  >
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.id === project.id ? "Ungrouped" : g.title}
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
                      state.moveScene(
                        selected.id,
                        selectedGroup,
                        siblings[selectedIndex - 1]?.scene.id,
                      )
                    }
                  >
                    ↑ Earlier
                  </button>
                  <button
                    disabled={selectedIndex === siblings.length - 1}
                    aria-label={`Move ${selected.title} later`}
                    onClick={() =>
                      state.moveScene(
                        selected.id,
                        selectedGroup,
                        siblings[selectedIndex + 2]?.scene.id,
                      )
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
                  onChange={(event) =>
                    state.patchNode(selected.id, { needsWork: event.target.checked })
                  }
                />
                Mark for another pass
              </label>
            </div>
            <footer>
              <button
                className="sb-quiet"
                onClick={() => {
                  void state.forceSave();
                  state.select([]);
                }}
              >
                Save scene
              </button>
              <button className="sb-primary" onClick={onScript}>
                Open script ↗
              </button>
            </footer>
          </aside>
        ) : (
          <aside className="sb-editor sb-editor--empty">
            <div>
              <span className="sb-empty-icon">✎</span>
              <h3>Make every scene count</h3>
              <p>
                Select a scene to shape its outline, find its turning point, or move it in the
                story.
              </p>
              <span>Drag the numbered grip to reorder.</span>
            </div>
          </aside>
        )}
      </div>
    </section>
  );
}
