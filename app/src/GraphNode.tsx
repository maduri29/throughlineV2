import { Handle, Position } from "@xyflow/react";
import type { Node, NodeProps } from "@xyflow/react";

export type CardData = {
  kind: "scene" | "flashback" | "pill";
  title: string;
  badge?: string;
  synopsis?: string;
};

export type CardFlowNode = Node<CardData, "card">;

/** Beat-board card (locked Map direction): rich light card; pills for non-scene nodes. */
export default function GraphCard({ data }: NodeProps<CardFlowNode>) {
  return (
    <div className={`tln-card tln-card--${data.kind}`}>
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <div className="tln-card__head">
        <span className="tln-card__title">{data.title}</span>
        {data.badge ? <span className="tln-card__badge">{data.badge}</span> : null}
      </div>
      {data.synopsis ? <div className="tln-card__syn">{data.synopsis}</div> : null}
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </div>
  );
}
