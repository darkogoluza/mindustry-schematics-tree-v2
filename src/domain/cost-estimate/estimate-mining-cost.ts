import { drills } from "../data/drills.data";
import { requireBelt } from "../planner/belt-lookup";
import type { DrillOption, BeltSaturation } from "../planner/mining-plan";
import type { OverdriveVariant } from "../planner/overdrive-variants";
import type { LiquidId } from "../types";
import { mergeBuildCosts, overdriveCost, type CostEstimate } from "./shared";

/**
 * Estimates power draw, liquid draw, and build cost for one (drill, cooling) option saturating
 * one belt. Assumes the cooling boost resource is a liquid — true for every drill in the current
 * dataset (water); would need extending if an item-fed booster drill is added later.
 */
export function estimateMiningCost(option: DrillOption, saturation: BeltSaturation, overdriveVariant: OverdriveVariant): CostEstimate {
  const drill = drills.find((d) => d.id === option.drillId);
  if (!drill) throw new Error(`expected drill "${option.drillId}" in drill data`);

  const belt = requireBelt(saturation.beltId);
  const od = overdriveCost(overdriveVariant);

  const liquidDraw =
    option.cooling.active && option.cooling.boostResourceId && option.cooling.boostConsumptionRate
      ? [{ liquidId: option.cooling.boostResourceId as LiquidId, rate: option.cooling.boostConsumptionRate * saturation.drillsNeeded }]
      : [];

  return {
    powerDraw: drill.power * saturation.drillsNeeded + od.power,
    liquidDraw,
    buildCost: mergeBuildCosts([...Array(saturation.drillsNeeded).fill(drill.buildCost), belt.buildCost, od.buildCost]),
  };
}
