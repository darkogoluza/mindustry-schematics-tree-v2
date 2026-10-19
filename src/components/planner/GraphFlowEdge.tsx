import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";

interface EdgeData {
  label?: string;
}

export function GraphFlowEdge({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const edgeData = data as EdgeData | undefined;

  return (
    <>
      <BaseEdge path={edgePath} style={{ stroke: "var(--border)", strokeWidth: 1.5 }} />
      {edgeData?.label && (
        <EdgeLabelRenderer>
          <div
            className="absolute rounded-full border border-border bg-card px-1.5 py-0.5 text-[10px] text-muted-foreground shadow-sm"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, pointerEvents: "none" }}
          >
            {edgeData.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
