import { cn } from "cn";
import type { CostEstimate } from "@/domain/cost-estimate/shared";
import { findCatalogEntity } from "@/domain/catalog";
import { EntityIcon } from "@/components/catalog/EntityIcon";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

function itemName(id: string): string {
  return findCatalogEntity(id)?.name ?? id;
}

function itemIcon(id: string): string {
  return findCatalogEntity(id)?.icon ?? `${import.meta.env.BASE_URL}icons/${id}.png`;
}

/** Green when belts are well-matched to what's produced, amber/red the further off (overflow waste or idle belt capacity) it gets. */
function efficiencyChip(efficiency: number): string {
  if (efficiency >= 0.8) return "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300";
  if (efficiency >= 0.5) return "bg-amber-500/20 text-amber-700 dark:text-amber-300";
  return "bg-red-500/20 text-red-700 dark:text-red-300";
}

/** Same tiering as efficiency, but bolder — this is the headline number. */
function scoreChip(score: number): string {
  if (score >= 80) return "bg-emerald-500/25 text-emerald-700 dark:text-emerald-300";
  if (score >= 50) return "bg-amber-500/25 text-amber-700 dark:text-amber-300";
  return "bg-red-500/25 text-red-700 dark:text-red-300";
}

interface PermutationCostSummaryProps {
  cost: CostEstimate;
  /** 0..100 composite rating — the headline number this design is ranked by. */
  score: number;
  efficiency: number;
  /** Whole-design floor space: every factory and drill combined. */
  totalArea: number;
  /** Subset of totalArea that's drills specifically (they must sit on the ore patch). */
  drillArea: number;
  /** Estimated units of the target item carried out per minute, capped at the output belt's throughput. */
  outputPerMinute: number;
}

/** Small inline cost chips for a permutation header — reuses the same hue scheme as the graph's stat chips (power=amber, water/liquid=cyan). */
export function PermutationCostSummary({ cost, score, efficiency, totalArea, drillArea, outputPerMinute }: PermutationCostSummaryProps) {
  const waterDraw = cost.liquidDraw.find((l) => l.liquidId === "water");
  const otherLiquids = cost.liquidDraw.filter((l) => l.liquidId !== "water");

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
      <Tooltip>
        <TooltipTrigger className={cn("rounded px-2 py-0.5 text-xs font-extrabold", scoreChip(score))}>Score {score}</TooltipTrigger>
        <TooltipContent>
          Composite 0–100 rating: efficiency and output weigh highest, drill area heavily (locked to the ore patch), power/water moderately, total area
          lightly, and build-material exoticness (synthesis steps from raw ore) moderately-high.
        </TooltipContent>
      </Tooltip>
      <span className={cn("rounded px-1.5 py-0.5 font-bold", efficiencyChip(efficiency))}>Efficiency {Math.round(efficiency * 100)}%</span>
      <Tooltip>
        <TooltipTrigger className="rounded bg-indigo-500/20 px-1.5 py-0.5 font-bold text-indigo-700 dark:text-indigo-300">
          Output {outputPerMinute.toFixed(0)}/min
        </TooltipTrigger>
        <TooltipContent>Estimated units of the target item carried out per minute, capped at what one output belt of this type can carry.</TooltipContent>
      </Tooltip>
      <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-bold text-amber-700 dark:text-amber-300">Power {cost.powerDraw.toFixed(0)}/s</span>
      <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 font-bold text-cyan-700 dark:text-cyan-300">Water {(waterDraw?.rate ?? 0).toFixed(2)}/s</span>
      {otherLiquids.map((l) => (
        <span key={l.liquidId} className="rounded bg-cyan-500/20 px-1.5 py-0.5 font-bold text-cyan-700 dark:text-cyan-300">
          {itemName(l.liquidId)} {l.rate.toFixed(2)}/s
        </span>
      ))}
      <Tooltip>
        <TooltipTrigger className="rounded bg-slate-500/20 px-1.5 py-0.5 font-bold text-slate-700 dark:text-slate-300">Area {totalArea} tiles</TooltipTrigger>
        <TooltipContent>Total floor space for the whole design — every factory and drill combined. Excludes conveyor belts.</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger className="rounded bg-violet-500/20 px-1.5 py-0.5 font-bold text-violet-700 dark:text-violet-300">
          Drill area {drillArea} tiles
        </TooltipTrigger>
        <TooltipContent>Of that area, the ore-patch tiles taken up by drills specifically — they must sit on the ore, unlike factories. Excludes conveyor belts.</TooltipContent>
      </Tooltip>
      <span className="w-full" />
      <span className="text-muted-foreground">Build:</span>
      {cost.buildCost.length === 0 ? (
        <span className="rounded bg-muted px-1.5 py-0.5 font-semibold text-muted-foreground">none</span>
      ) : (
        cost.buildCost.map((entry) => (
          <span key={entry.item} className="flex items-center gap-1 rounded bg-muted py-0.5 pr-1.5 pl-0.5 font-semibold text-foreground">
            <EntityIcon icon={itemIcon(entry.item)} name={itemName(entry.item)} size={16} />
            ×{entry.amount}
          </span>
        ))
      )}
    </div>
  );
}
