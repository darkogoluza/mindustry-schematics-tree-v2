import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { cn } from "cn";
import { EntityIcon } from "@/components/catalog/EntityIcon";
import type { FlowNodeData } from "./graph-flow";
import type { GraphNodeKind } from "@/domain/planner/craft-permutations";

/** Subtle left-edge accent per kind — identity without loud full-border color. */
const KIND_ACCENT: Record<GraphNodeKind, string> = {
  item: "border-l-sky-500",
  liquid: "border-l-cyan-400",
  factory: "border-l-amber-500",
  drill: "border-l-violet-500",
  belt: "border-l-teal-500",
  overdrive: "border-l-rose-500",
};

const KIND_DOT: Record<GraphNodeKind, string> = {
  item: "bg-sky-500",
  liquid: "bg-cyan-400",
  factory: "bg-amber-500",
  drill: "bg-violet-500",
  belt: "bg-teal-500",
  overdrive: "bg-rose-500",
};

const KIND_LABEL: Record<GraphNodeKind, string> = {
  item: "Item",
  liquid: "Liquid",
  factory: "Factory",
  drill: "Drill",
  belt: "Belt",
  overdrive: "Overdrive",
};

/** Color-codes a stat row's value by what resource it's about (power, mining/craft rate, water/liquid), independent of node kind color. */
function statChip(label: string): string | undefined {
  const l = label.toLowerCase();
  if (l.includes("power")) return "bg-amber-500/20 text-amber-700 dark:text-amber-300";
  if (l.includes("water") || l.includes("liquid")) return "bg-cyan-500/20 text-cyan-700 dark:text-cyan-300";
  if (l.includes("rate") || l.includes("speed")) return "bg-sky-500/20 text-sky-700 dark:text-sky-300";
  return undefined;
}

export function GraphFlowNode({ data }: NodeProps<Node<FlowNodeData>>) {
  return (
    <div
      className={cn("flex flex-col gap-2 rounded-lg border border-l-4 border-border bg-card px-3 py-2.5 shadow-sm", KIND_ACCENT[data.kind])}
      style={{ width: 220 }}
    >
      <Handle type="target" position={Position.Bottom} className="opacity-0" />
      <Handle type="source" position={Position.Top} className="opacity-0" />

      <div className="flex items-center gap-2.5">
        <div className="flex shrink-0 items-center">
          <EntityIcon icon={data.icon} name={data.label} size={44} />
          {data.secondaryIcon && (
            <EntityIcon icon={data.secondaryIcon} name={data.secondaryIconLabel ?? data.label} size={28} className="-ml-2.5 ring-2 ring-card" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <span className="block text-sm leading-tight font-semibold break-words">{data.label}</span>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="flex shrink-0 items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground uppercase">
              <span className={cn("size-1.5 rounded-full", KIND_DOT[data.kind])} />
              {KIND_LABEL[data.kind]}
            </span>
            {data.badge && <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground uppercase">{data.badge}</span>}
          </div>
        </div>
      </div>

      {data.stats && data.stats.length > 0 && (
        <div className="space-y-1 border-t border-border pt-1.5">
          {data.stats.map((stat) => {
            const chip = statChip(stat.label);
            return (
              <div key={stat.label} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">{stat.label}</span>
                <span className={cn("rounded px-1.5 py-0.5 font-bold", chip ?? "font-semibold text-foreground")}>{stat.value}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
