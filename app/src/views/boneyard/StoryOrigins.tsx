import { useGraphStore } from "../../store";

export function StoryOrigins({ onOpen }: { onOpen: (id: string) => void }) {
  const nodes = useGraphStore((s) => s.nodes);
  const projectId = useGraphStore((s) => s.projectId);
  const sources = new Map(
    Object.values(nodes)
      .filter((n) => n.id === projectId || n.parentId === projectId)
      .flatMap((n) => n.ideaSources ?? [])
      .map((source) => [source.id, source]),
  );
  if (!sources.size) return null;
  return (
    <details className="by-origins">
      <summary>Ideas behind this story ({sources.size})</summary>
      {[...sources.values()].map((source) => (
        <div key={source.id}>
          <strong>{source.title}</strong>
          <p>{source.body}</p>
          <button className="tln-btn" onClick={() => onOpen(source.id)}>
            Explore source idea
          </button>
        </div>
      ))}
    </details>
  );
}
