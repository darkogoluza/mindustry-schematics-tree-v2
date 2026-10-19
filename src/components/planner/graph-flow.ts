import type { Node, Edge } from "@xyflow/react";
import { Position } from "@xyflow/react";
import type { GraphNode } from "@/domain/planner/craft-permutations";

export const NODE_WIDTH = 220;
const NODE_HEIGHT_ESTIMATE = 90;
const COL_GAP = 40;
const ROW_GAP = 130;

/** React Flow requires node data to be an index-signature record; GraphNode is structurally compatible. */
export type FlowNodeData = GraphNode & Record<string, unknown>;

export interface GraphFlowResult {
  readonly nodes: readonly Node<FlowNodeData>[];
  readonly edges: readonly Edge[];
  readonly width: number;
  readonly height: number;
}

/**
 * Converts one or more GraphNode trees into React Flow nodes/edges with manual positions (simple
 * top-down tree layout: leaves get sequential slots, parents center over their children). Multiple
 * roots are laid out side by side as a forest — no edges between them (e.g. the main production
 * tree plus a standalone, unconnected overdrive subgraph). Each tree node gets a unique flow-id
 * (path-based, prefixed by tree index) since the same item/factory can recur in multiple branches.
 */
export function toReactFlow(roots: readonly GraphNode[]): GraphFlowResult {
  let nextSlot = 0;
  const slotOf = new Map<string, number>();
  const depthOf = new Map<string, number>();

  function place(node: GraphNode, path: string, depth: number): number {
    depthOf.set(path, depth);
    if (!node.children || node.children.length === 0) {
      const slot = nextSlot++;
      slotOf.set(path, slot);
      return slot;
    }
    const childSlots = node.children.map((child, i) => place(child, `${path}.${i}`, depth + 1));
    const slot = (Math.min(...childSlots) + Math.max(...childSlots)) / 2;
    slotOf.set(path, slot);
    return slot;
  }
  roots.forEach((root, treeIndex) => place(root, `${treeIndex}`, 0));

  const colWidth = NODE_WIDTH + COL_GAP;
  const rowHeight = NODE_HEIGHT_ESTIMATE + ROW_GAP;

  const nodes: Node<FlowNodeData>[] = [];
  const edges: Edge[] = [];

  function collect(node: GraphNode, path: string, parentPath: string | undefined) {
    const x = slotOf.get(path)! * colWidth;
    const y = depthOf.get(path)! * rowHeight;

    nodes.push({
      id: path,
      type: "craftNode",
      position: { x, y },
      data: node as FlowNodeData,
      draggable: false,
      selectable: false,
      sourcePosition: Position.Top,
      targetPosition: Position.Bottom,
    });

    if (parentPath !== undefined) {
      edges.push({
        id: `${path}->${parentPath}`,
        source: path,
        target: parentPath,
        type: "craftEdge",
        data: { label: node.edgeLabel },
        selectable: false,
      });
    }

    node.children?.forEach((child, i) => collect(child, `${path}.${i}`, path));
  }
  roots.forEach((root, treeIndex) => collect(root, `${treeIndex}`, undefined));

  const maxSlot = Math.max(...[...slotOf.values()]);
  const maxDepth = Math.max(...[...depthOf.values()]);

  return {
    nodes,
    edges,
    width: (maxSlot + 1) * colWidth + COL_GAP,
    height: (maxDepth + 1) * rowHeight + ROW_GAP,
  };
}
