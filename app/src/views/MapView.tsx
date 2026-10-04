// The Map lens per the T5 canvas contract: Beat×Storyline bands, filter chips,
// drag-connect legality picker, context-aware double-click add, instant delete
// with undo toast, marquee + shift-click multi-select, RF-default pan/zoom.
import { Background, Controls, ReactFlow, ReactFlowProvider, SelectionMode } from "@xyflow/react";
import type { NodeTypes } from "@xyflow/react";
import GraphCard from "../GraphNode";
import MapConnectPicker from "./map/MapConnectPicker";
import MapToastOverlay from "./map/MapToastOverlay";
import MapToolbar from "./map/MapToolbar";
import { useMapWorkspace } from "./map/useMapWorkspace";
import "./map/map.css";

const nodeTypes = { card: GraphCard } satisfies NodeTypes;

export default function MapView() {
  return (
    <ReactFlowProvider>
      <MapInner />
    </ReactFlowProvider>
  );
}

function MapInner() {
  const ws = useMapWorkspace();

  return (
    <div className="tln-map" onDoubleClick={ws.onDoubleClick}>
      <MapToolbar
        filters={ws.filters}
        onToggleFilter={ws.toggleFilter}
        onAddNodeType={ws.addNodeOfType}
      />

      <div className="tln-flow">
        <ReactFlow
          nodes={ws.rfNodes}
          edges={ws.rfEdges}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.25}
          maxZoom={2.5}
          selectionOnDrag
          panOnDrag={[1, 2]}
          selectionMode={SelectionMode.Partial}
          proOptions={{ hideAttribution: true }}
          onNodesChange={ws.onSelectionChanges}
          onEdgesChange={ws.onSelectionChanges}
          onPaneClick={ws.onPaneClick}
          onConnectEnd={ws.onConnectEnd}
        >
          <Background color="var(--line)" gap={20} size={1} />
          <Controls />
        </ReactFlow>
      </div>

      {ws.pending ? (
        <MapConnectPicker
          pending={ws.pending}
          allowedTypes={ws.pendingTypes}
          onPick={ws.pickType}
          onCancel={ws.cancelPending}
        />
      ) : null}

      <MapToastOverlay toasts={ws.toasts} onUndo={ws.handleUndo} />
    </div>
  );
}
