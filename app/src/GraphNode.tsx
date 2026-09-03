import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { Node, NodeProps } from "@xyflow/react";

export type CardData = {
  kind: "scene" | "flashback" | "pill";
  /** Story-object type, purely for colour (see .tln-card--t-* in styles.css). */
  nodeType?: string;
  title: string;
  badge?: string;
  synopsis?: string;
};

export type CardFlowNode = Node<CardData, "card">;

/** Beat-board card (locked Map direction): rich light card; pills for non-scene nodes.
 *  Handles are live — drag-connect opens the legality picker (T5 contract). */
function GraphCardComponent({ data }: NodeProps<CardFlowNode>) {
  return (
    <div
      className={`tln-card tln-card--${data.kind}${
        data.nodeType ? ` tln-card--t-${data.nodeType}` : ""
      }`}
    >
      <Handle type="target" position={Position.Left} />
      <div className="tln-card__head">
        <span className="tln-card__title">{data.title}</span>
        {data.badge ? <span className="tln-card__badge">{data.badge}</span> : null}
      </div>
      {data.synopsis ? <div className="tln-card__syn">{data.synopsis}</div> : null}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export default memo(GraphCardComponent);
