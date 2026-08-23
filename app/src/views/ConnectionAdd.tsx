// "Add connection" section for the Inspector dock. Rendered by App beneath
// <Inspector /> so the dock stays one column; kept separate while Inspector
// sees concurrent edits. Legality-aware: targets and edge types come from
// connectionTargets(), already-used types are filtered, connect() re-checks.
import { useMemo, useState } from "react";
import { connectionTargets } from "../data/connections";
import { useGraphStore } from "../store";
import type { EdgeType } from "../types";

export default function ConnectionAdd() {
  const nodeId = useGraphStore((s) => s.selection.find((id) => Boolean(s.nodes[id])) ?? null);
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const connect = useGraphStore((s) => s.connect);

  const candidates = useMemo(
    () => (nodeId ? connectionTargets(nodes, edges, nodeId) : []),
    [nodes, edges, nodeId],
  );

  const [open, setOpen] = useState(false);
  // Reset picks whenever the inspected node changes — derive-during-render.
  const [prevNode, setPrevNode] = useState(nodeId);
  if (prevNode !== nodeId) {
    setPrevNode(nodeId);
    setOpen(false);
  }
  const [targetIdx, setTargetIdx] = useState(0);
  const [typeIdx, setTypeIdx] = useState(0);

  if (!nodeId || !open) {
    return (
      <div className="tln-conncadd">
        <button
          className="tln-conncadd__btn"
          disabled={candidates.length === 0}
          onClick={() => {
            setTargetIdx(0);
            setTypeIdx(0);
            setOpen(true);
          }}
        >
          + Add connection
        </button>
      </div>
    );
  }

  const cand = candidates[targetIdx] as { targetId: string; types: EdgeType[] } | undefined;
  const type = cand?.types[typeIdx];

  return (
    <div className="tln-conncadd tln-conncadd--open">
      <select
        aria-label="Target node"
        value={targetIdx}
        onChange={(e) => {
          setTargetIdx(Number(e.target.value));
          setTypeIdx(0);
        }}
      >
        {candidates.map((c, i) => (
          <option key={c.targetId} value={i}>
            {nodes[c.targetId]?.title ?? c.targetId} ({nodes[c.targetId]?.type})
          </option>
        ))}
      </select>
      <select
        aria-label="Connection type"
        value={typeIdx}
        onChange={(e) => setTypeIdx(Number(e.target.value))}
        disabled={!cand}
      >
        {(cand?.types ?? []).map((t, i) => (
          <option key={t} value={i}>
            {t}
          </option>
        ))}
      </select>
      <div className="tln-conncadd__row">
        <button
          className="tln-conncadd__btn tln-conncadd__btn--primary"
          disabled={!cand || !type}
          onClick={() => {
            if (cand && type) connect(nodeId, cand.targetId, type);
            setOpen(false);
          }}
        >
          Link
        </button>
        <button className="tln-conncadd__btn" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
