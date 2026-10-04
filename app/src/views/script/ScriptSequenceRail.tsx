import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Layers,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
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
  onAddScene?: (containerId?: string) => void;
  onMoveScene?: (sceneId: string, containerId: string, beforeId?: string) => void;
  onDeleteScene?: (sceneId: string) => void;
  onCloseMobileRail?: () => void;
};

export default function ScriptSequenceRail({
  sequence,
  effectiveSceneId,
  locationBySceneId,
  onSelectScene,
  onAddScene,
  onMoveScene,
  onDeleteScene,
  onCloseMobileRail,
}: ScriptSequenceRailProps) {
  const [filterQuery, setFilterQuery] = useState("");
  const [activeEpisodeId, setActiveEpisodeId] = useState<string | null>("all");
  const [collapsedEpisodes, setCollapsedEpisodes] = useState<Record<string, boolean>>({});

  // Extract distinct episodes / containers
  const episodes = useMemo(() => {
    const map = new Map<string, { id: string; title: string; count: number }>();
    for (const item of sequence) {
      const id = item.container?.id ?? "standalone";
      const title = item.container?.title ?? "Ungrouped Scenes";
      const existing = map.get(id);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(id, { id, title, count: 1 });
      }
    }
    return Array.from(map.values());
  }, [sequence]);

  // Group scenes by episode, applying episode pill filter & text search query
  const groupedSections = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    const groups: Array<{
      id: string;
      title: string;
      items: Array<{ item: SequenceItem; overallIndex: number; episodeIndex: number }>;
    }> = [];

    const map = new Map<
      string,
      {
        id: string;
        title: string;
        items: Array<{ item: SequenceItem; overallIndex: number; episodeIndex: number }>;
      }
    >();

    // Index tracking within each container
    const containerIndices = new Map<string, number>();

    sequence.forEach((item, index) => {
      const containerId = item.container?.id ?? "standalone";
      const containerTitle = item.container?.title ?? "Ungrouped Scenes";

      const currentEpIdx = containerIndices.get(containerId) ?? 0;
      containerIndices.set(containerId, currentEpIdx + 1);

      // Episode pill filter
      if (activeEpisodeId !== "all" && containerId !== activeEpisodeId) {
        return;
      }

      // Text query search
      if (q) {
        const titleMatch = item.scene.title.toLowerCase().includes(q);
        const epMatch = containerTitle.toLowerCase().includes(q);
        const todMatch = Boolean(item.scene.storyTime?.tod?.toLowerCase().includes(q));
        const intExtMatch = Boolean(item.scene.intExt?.toLowerCase().includes(q));
        const loc = locationBySceneId.get(item.scene.id)?.toLowerCase() ?? "";
        const locMatch = loc.includes(q);
        if (!titleMatch && !epMatch && !todMatch && !intExtMatch && !locMatch) {
          return;
        }
      }

      let grp = map.get(containerId);
      if (!grp) {
        grp = { id: containerId, title: containerTitle, items: [] };
        map.set(containerId, grp);
        groups.push(grp);
      }
      grp.items.push({ item, overallIndex: index, episodeIndex: currentEpIdx });
    });

    return groups;
  }, [sequence, activeEpisodeId, filterQuery, locationBySceneId]);

  const toggleEpisodeCollapse = (epId: string) => {
    setCollapsedEpisodes((prev) => ({
      ...prev,
      [epId]: !prev[epId],
    }));
  };

  const handleMoveUp = (
    e: React.MouseEvent,
    sceneId: string,
    containerId: string,
    epIdx: number,
    groupItems: Array<{ item: SequenceItem }>,
  ) => {
    e.stopPropagation();
    if (epIdx <= 0 || !onMoveScene) return;
    const beforeId = groupItems[epIdx - 1]?.item.scene.id;
    if (beforeId) {
      onMoveScene(sceneId, containerId, beforeId);
    }
  };

  const handleMoveDown = (
    e: React.MouseEvent,
    sceneId: string,
    containerId: string,
    epIdx: number,
    groupItems: Array<{ item: SequenceItem }>,
  ) => {
    e.stopPropagation();
    if (epIdx >= groupItems.length - 1 || !onMoveScene) return;
    const beforeId = epIdx + 2 < groupItems.length ? groupItems[epIdx + 2]?.item.scene.id : undefined;
    onMoveScene(sceneId, containerId, beforeId);
  };

  const handleDelete = (e: React.MouseEvent, sceneId: string) => {
    e.stopPropagation();
    onDeleteScene?.(sceneId);
  };

  return (
    <aside className="tln-script__rail" aria-label="Script sequence and scenes">
      {/* Mobile top close bar */}
      {onCloseMobileRail && (
        <div className="tln-script__mobile-rail-bar">
          <button
            type="button"
            className="tln-script__mobile-rail-close"
            onClick={onCloseMobileRail}
          >
            <ChevronLeft size={16} aria-hidden="true" />
            <span>Return to Editor</span>
          </button>
        </div>
      )}

      {/* Rail Header with Quick Add */}
      <div className="tln-script__rail-head">
        <div className="tln-script__rail-head-meta">
          <Layers size={13} className="tln-script__rail-head-icon" aria-hidden="true" />
          <span className="tln-script__rail-title">SCENES</span>
          <span className="tln-script__rail-count">
            {sequence.length}
            {episodes.length > 1 ? ` · ${episodes.length} episodes` : ""}
          </span>
        </div>

        {onAddScene && (
          <button
            type="button"
            className="tln-script__rail-add-top"
            onClick={() => onAddScene(activeEpisodeId && activeEpisodeId !== "all" ? activeEpisodeId : undefined)}
            title="Add a new scene"
            aria-label="Add a new scene"
          >
            <Plus size={13} aria-hidden="true" />
            <span>New Scene</span>
          </button>
        )}
      </div>

      {/* Quick Search */}
      <div className="tln-script__rail-search">
        <Search size={13} className="tln-script__search-icon" aria-hidden="true" />
        <input
          type="search"
          placeholder="Search scene, slugline, episode..."
          aria-label="Search scenes"
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
        />
        {filterQuery && (
          <button
            type="button"
            className="tln-script__search-clear"
            onClick={() => setFilterQuery("")}
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      {/* Episode Filter Pills (shown when multiple containers exist) */}
      {episodes.length > 1 && (
        <div className="tln-script__ep-pills" role="tablist" aria-label="Filter by episode">
          <button
            type="button"
            role="tab"
            aria-selected={activeEpisodeId === "all"}
            className={`tln-script__ep-pill${activeEpisodeId === "all" ? " tln-script__ep-pill--active" : ""}`}
            onClick={() => setActiveEpisodeId("all")}
          >
            All ({sequence.length})
          </button>
          {episodes.map((ep) => (
            <button
              key={ep.id}
              type="button"
              role="tab"
              aria-selected={activeEpisodeId === ep.id}
              className={`tln-script__ep-pill${activeEpisodeId === ep.id ? " tln-script__ep-pill--active" : ""}`}
              onClick={() => setActiveEpisodeId(ep.id)}
              title={ep.title}
            >
              {ep.title} ({ep.count})
            </button>
          ))}
        </div>
      )}

      {/* Grouped Episode Sections */}
      <div className="tln-script__rail-scenes">
        {groupedSections.length === 0 ? (
          <div className="tln-script__rail-empty">
            {filterQuery ? (
              <>
                <p>No scenes match "{filterQuery}"</p>
                <button
                  type="button"
                  className="tln-script__rail-empty-btn"
                  onClick={() => setFilterQuery("")}
                >
                  Clear search
                </button>
              </>
            ) : (
              <>
                <p>No scenes in this story yet</p>
                {onAddScene && (
                  <button
                    type="button"
                    className="tln-script__rail-empty-btn"
                    onClick={() => onAddScene()}
                  >
                    Add first scene
                  </button>
                )}
              </>
            )}
          </div>
        ) : (
          groupedSections.map((group) => {
            const isCollapsed = Boolean(collapsedEpisodes[group.id]);

            return (
              <section key={group.id} className="tln-script__ep-group" aria-label={group.title}>
                {/* Episode header with collapse toggle and inline + button */}
                <div className="tln-script__ep-group-header">
                  <button
                    type="button"
                    className="tln-script__ep-toggle-btn"
                    onClick={() => toggleEpisodeCollapse(group.id)}
                    aria-expanded={!isCollapsed}
                    title={isCollapsed ? "Expand episode" : "Collapse episode"}
                  >
                    {isCollapsed ? (
                      <ChevronRight size={13} aria-hidden="true" />
                    ) : (
                      <ChevronDown size={13} aria-hidden="true" />
                    )}
                    <span className="tln-script__ep-group-title">{group.title}</span>
                    <span className="tln-script__ep-group-badge">{group.items.length}</span>
                  </button>

                  {onAddScene && (
                    <button
                      type="button"
                      className="tln-script__ep-add-btn"
                      onClick={() => onAddScene(group.id !== "standalone" ? group.id : undefined)}
                      title={`Add scene to ${group.title}`}
                      aria-label={`Add scene to ${group.title}`}
                    >
                      <Plus size={12} aria-hidden="true" />
                      <span>Scene</span>
                    </button>
                  )}
                </div>

                {!isCollapsed && (
                  <div className="tln-script__ep-group-items">
                    {group.items.map(({ item: { scene: sc }, overallIndex, episodeIndex }) => {
                      const isSelected = sc.id === effectiveSceneId;
                      const locTitle =
                        locationBySceneId.get(sc.id) ??
                        (sc.title &&
                        !sc.title.toLowerCase().startsWith("new scene") &&
                        sc.title.toLowerCase() !== "untitled scene"
                          ? sc.title
                          : null);
                      const itemSlug = slugFor(sc, locTitle);
                      const isFlashback = (sc.storyTime?.storyDay ?? 0) < 0;

                      return (
                        <div
                          key={sc.id}
                          className={`tln-script__item-wrap${isSelected ? " tln-script__item-wrap--active" : ""}`}
                        >
                          <button
                            type="button"
                            className={`tln-script__item${isSelected ? " tln-script__item--on" : ""}`}
                            onClick={() => onSelectScene(sc.id)}
                            title={itemSlug}
                            aria-current={isSelected ? "true" : undefined}
                          >
                            <div className="tln-script__item-top">
                              <span className="tln-script__item-num">#{overallIndex + 1}</span>
                              {isFlashback && (
                                <span className="tln-script__item-tag">⟲ Flashback</span>
                              )}
                              <span className="tln-script__item-slug-preview">{itemSlug}</span>
                            </div>

                            <span className="tln-script__ttl">
                              {sc.title || "Untitled Scene"}
                            </span>
                          </button>

                          {/* Quick item actions (reorder & delete) */}
                          <div className="tln-script__item-actions" role="toolbar" aria-label="Scene actions">
                            {onMoveScene && group.items.length > 1 && (
                              <>
                                <button
                                  type="button"
                                  className="tln-script__item-action-btn"
                                  disabled={episodeIndex === 0}
                                  onClick={(e) =>
                                    handleMoveUp(e, sc.id, group.id, episodeIndex, group.items)
                                  }
                                  title="Move scene up"
                                  aria-label="Move scene up"
                                >
                                  <ChevronUp size={13} aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  className="tln-script__item-action-btn"
                                  disabled={episodeIndex === group.items.length - 1}
                                  onClick={(e) =>
                                    handleMoveDown(e, sc.id, group.id, episodeIndex, group.items)
                                  }
                                  title="Move scene down"
                                  aria-label="Move scene down"
                                >
                                  <ChevronDown size={13} aria-hidden="true" />
                                </button>
                              </>
                            )}

                            {onDeleteScene && (
                              <button
                                type="button"
                                className="tln-script__item-action-btn tln-script__item-action-btn--delete"
                                onClick={(e) => handleDelete(e, sc.id)}
                                title="Delete scene"
                                aria-label="Delete scene"
                              >
                                <Trash2 size={12} aria-hidden="true" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })
        )}
      </div>

      {onAddScene && (
        <button
          type="button"
          className="tln-script__add-btn"
          onClick={() => onAddScene(activeEpisodeId && activeEpisodeId !== "all" ? activeEpisodeId : undefined)}
          title="Add a new scene"
        >
          <Plus size={14} aria-hidden="true" />
          <span>Add scene</span>
        </button>
      )}
    </aside>
  );
}
