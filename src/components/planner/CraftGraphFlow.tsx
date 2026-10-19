import { useMemo } from "react";
import { ReactFlow, Background, Controls, BackgroundVariant } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { GraphNode } from "@/domain/planner/craft-permutations";
import { toReactFlow } from "./graph-flow";
import { GraphFlowNode } from "./GraphFlowNode";
import { GraphFlowEdge } from "./GraphFlowEdge";

const nodeTypes = { craftNode: GraphFlowNode };
const edgeTypes = { craftEdge: GraphFlowEdge };

export function CraftGraphFlow({ roots }: { roots: readonly GraphNode[] }) {
  const flow = useMemo(() => toReactFlow(roots), [roots]);

  return (
    <div style={{ width: "100%", height: Math.min(flow.height, 560) }} className="overflow-hidden rounded-lg border border-border">
      <ReactFlow
        nodes={[...flow.nodes]}
        edges={[...flow.edges]}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag
        zoomOnScroll={false}
        zoomOnPinch
        zoomOnDoubleClick={false}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
