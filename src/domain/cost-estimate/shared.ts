import { overdrives } from "../data/overdrives.data";
import type { OverdriveVariant } from "../planner/overdrive-variants";
import type { BuildCostEntry, ItemId, LiquidId } from "../types";

export interface LiquidDraw {
  readonly liquidId: LiquidId;
  readonly rate: number;
}

export interface CostEstimate {
  /** Total power units/second drawn by every building in this scenario. */
  readonly powerDraw: number;
  readonly liquidDraw: readonly LiquidDraw[];
  /** One-time build cost, consolidated (summed) per item across every building involved. */
  readonly buildCost: readonly BuildCostEntry[];
}

/** Sums build-cost lists together, consolidating duplicate items into one entry. */
export function mergeBuildCosts(costLists: readonly (readonly BuildCostEntry[])[]): readonly BuildCostEntry[] {
  const totals = new Map<ItemId, number>();
  for (const list of costLists) {
    for (const entry of list) {
      totals.set(entry.item, (totals.get(entry.item) ?? 0) + entry.amount);
    }
  }
  return [...totals.entries()].map(([item, amount]) => ({ item, amount }));
}

/** Resolves an overdrive variant's own power draw and build cost (zero for "none"). */
export function overdriveCost(variant: OverdriveVariant): { power: number; buildCost: readonly BuildCostEntry[] } {
  if (!variant.overdriveId) return { power: 0, buildCost: [] };
  const od = overdrives.find((o) => o.id === variant.overdriveId);
  if (!od) throw new Error(`expected overdrive "${variant.overdriveId}" in overdrive data`);
  return { power: od.power, buildCost: od.buildCost };
}
