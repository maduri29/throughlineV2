import { useCallback, useMemo, useState } from "react";
import { useGraphStore } from "../../store";
import { scriptSequence } from "../../data/fountain";
import type { GraphNode } from "../../types";

export function useSequenceWorkspace() {
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const projectId = useGraphStore((s) => s.projectId);
  const selection = useGraphStore((s) => s.selection);
  const state = useGraphStore.getState();

  const [groupName, setGroupName] = useState("");
  const [addingGroup, setAddingGroup] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [collapsed, setCollapsed] = useState<string[]>([]);

  const project = projectId ? nodes[projectId] : undefined;

  const sequence = useMemo(
    () => (project ? scriptSequence(project, nodes, edges) : []),
    [project, nodes, edges],
  );

  const groups = useMemo(
    () =>
      project
        ? [
            project,
            ...(project.order ?? [])
              .map((id) => nodes[id])
              .filter((n): n is GraphNode => n?.type === "episode"),
          ]
        : [],
    [project, nodes],
  );

  const groupFor = useCallback(
    (container: GraphNode | null) =>
      container?.type === "episode" ? container.id : (project?.id ?? ""),
    [project?.id],
  );

  const visibleGroups = useMemo(
    () =>
      groups.filter(
        (g) =>
          g.id !== project?.id ||
          groups.length === 1 ||
          sequence.some((item) => groupFor(item.container) === project?.id),
      ),
    [groups, project?.id, sequence, groupFor],
  );

  const drafted = useMemo(() => {
    let count = 0;
    for (const item of sequence) {
      if (item.scene.fountain?.trim()) count++;
    }
    return count;
  }, [sequence]);

  const moveGroup = (id: string, direction: number) => {
    if (!project) return;
    const ordered = groups.slice(1);
    const index = ordered.findIndex((g) => g.id === id);
    if (index < 0) return;
    const other = ordered[index + direction];
    if (!other) return;
    const order = [...(project.order ?? [])];
    const a = order.indexOf(id);
    const b = order.indexOf(other.id);
    [order[a], order[b]] = [order[b]!, order[a]!];
    state.setOrder(project.id, order);
  };

  const selectionSet = useMemo(() => new Set(selection), [selection]);
  const chosen = useMemo(
    () => sequence.find((item) => selectionSet.has(item.scene.id)),
    [sequence, selectionSet],
  );
  const selected = chosen?.scene;
  const selectedGroup = chosen ? groupFor(chosen.container) : (project?.id ?? "");

  const siblings = useMemo(
    () => sequence.filter((item) => groupFor(item.container) === selectedGroup),
    [sequence, groupFor, selectedGroup],
  );

  const selectedIndex = selected ? siblings.findIndex((item) => item.scene.id === selected.id) : -1;
  const lowerQuery = useMemo(() => query.trim().toLowerCase(), [query]);

  const matching = useMemo(() => {
    if (!sequence.length) return [];
    const matchAll = filter === "all";
    return sequence.filter((item) => {
      if (!matchAll && groupFor(item.container) !== filter) return false;
      if (!lowerQuery) return true;
      const sc = item.scene;
      return (
        sc.title.toLowerCase().includes(lowerQuery) ||
        Boolean(sc.synopsis && sc.synopsis.toLowerCase().includes(lowerQuery)) ||
        Boolean(sc.turningPoint && sc.turningPoint.toLowerCase().includes(lowerQuery))
      );
    });
  }, [sequence, filter, groupFor, lowerQuery]);

  const add = (groupId: string) => {
    setQuery("");
    setFilter("all");
    setCollapsed((v) => v.filter((id) => id !== groupId));
    state.addScene(groupId);
  };

  const createGroup = () => {
    if (!groupName.trim()) return;
    state.addNodeOfType("episode", groupName.trim());
    setGroupName("");
    setAddingGroup(false);
    setFilter("all");
  };

  return {
    nodes,
    edges,
    project,
    projectId,
    sequence,
    groups,
    groupFor,
    visibleGroups,
    drafted,
    selected,
    selectedGroup,
    siblings,
    selectedIndex,
    matching,
    query,
    setQuery,
    filter,
    setFilter,
    collapsed,
    setCollapsed,
    addingGroup,
    setAddingGroup,
    groupName,
    setGroupName,
    moveGroup,
    add,
    createGroup,
  };
}
