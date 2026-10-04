import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
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
  const [filterQuery, setFilterQuery] = useState("");
  const [activeEpisodeId, setActiveEpisodeId] = useState<string | null>("all");

  // Extract distinct episodes / containers
  const episodes = useMemo(() => {
    const map = new Map<string, { id: string; title: string; count: number }>();
    for (const item of sequence) {
      const id = item.container?.id ?? "standalone";
      const title = item.container?.title ?? "Ungrouped";
      const existing = map.get(id);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(id, { id, title, count: 1 });
      }
    }
    return Array.from(map.values());
  }, [sequence]);

  // Group scenes by episode, applying both episode pill filter & text search query
  const groupedSections = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    const groups: Array<{
      id: string;
      title: string;
      items: Array<{ item: SequenceItem; overallIndex: number }>;
    }> = [];

    const map = new Map<
      string,
      { id: string; title: string; items: Array<{ item: SequenceItem; overallIndex: number }> }
    >();

    sequence.forEach((item, index) => {
      const containerId = item.container?.id ?? "standalone";
      const containerTitle = item.container?.title ?? "Ungrouped";

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
      grp.items.push({ item, overallIndex: index });
    });

    return groups;
  }, [sequence, activeEpisodeId, filterQuery, locationBySceneId]);

  return (
    <aside className="tln-script__rail" aria-label="Script sequence and scenes">
      <div className="tln-script__rail-head">
        <span className="tln-script__rail-title">SCRIPT ORDER</span>
        <span className="tln-script__rail-count">{sequence.length} scenes</span>
      </div>

      {/* Quick Search */}
      <div className="tln-script__rail-search">
        <Search size={13} className="tln-script__search-icon" aria-hidden="true" />
        <input
          type="search"
          placeholder="Filter scenes..."
          aria-label="Filter scenes"
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
          <div className="tln-script__rail-empty">No scenes match filter.</div>
        ) : (
          groupedSections.map((group) => (
            <section key={group.id} className="tln-script__ep-group" aria-label={group.title}>
              {episodes.length > 1 && (
                <div className="tln-script__ep-group-header">
                  <span className="tln-script__ep-group-title">{group.title}</span>
                  <span className="tln-script__ep-group-badge">{group.items.length}</span>
                </div>
              )}
              <div className="tln-script__ep-group-items">
                {group.items.map(({ item: { scene: sc }, overallIndex }) => {
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
                    <button
                      key={sc.id}
                      type="button"
                      className={`tln-script__item${isSelected ? " tln-script__item--on" : ""}`}
                      onClick={() => onSelectScene(sc.id)}
                      title={itemSlug}
                      aria-current={isSelected ? "true" : undefined}
                    >
                      <div className="tln-script__item-top">
                        <span className="tln-script__item-num">#{overallIndex + 1}</span>
                        {isFlashback && <span className="tln-script__item-tag">⟲ Flashback</span>}
                        {sc.intExt && <span className="tln-script__item-meta">{sc.intExt}</span>}
                        {sc.storyTime?.tod && (
                          <span className="tln-script__item-meta">{sc.storyTime.tod}</span>
                        )}
                      </div>
                      <span className="tln-script__ttl">{sc.title || "Untitled Scene"}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>

      {onAddScene && (
        <button
          type="button"
          className="tln-script__add-btn"
          onClick={onAddScene}
          title="Add a new scene"
        >
          <Plus size={14} aria-hidden="true" />
          <span>Add scene</span>
        </button>
      )}
    </aside>
  );
}
