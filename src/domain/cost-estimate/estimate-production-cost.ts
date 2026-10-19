import type { Factory } from "../types";
import type { ProductionPlan, BeltScenario } from "../planner/production-plan";
import { requireBelt } from "../planner/belt-lookup";
import type { OverdriveVariant } from "../planner/overdrive-variants";
import { mergeBuildCosts, overdriveCost, type CostEstimate } from "./shared";

/**
 * Estimates power draw, liquid draw, and build cost for one belt scenario of a production plan.
 * Belt build cost is approximated as one belt tile per input lane — actual belt run length
 * depends on factory layout, which the planner doesn't model.
 */
export function estimateProductionCost(
  factory: Factory,
  plan: ProductionPlan,
  scenario: BeltScenario,
  overdriveVariant: OverdriveVariant,
): CostEstimate {
  const beltCosts = scenario.belts.map((b) => requireBelt(b.beltId).buildCost);
  const od = overdriveCost(overdriveVariant);

  return {
    powerDraw: factory.power * scenario.factoryCount + od.power,
    liquidDraw: plan.liquidInputs.map((l) => ({ liquidId: l.liquidId, rate: l.perFactoryRate * scenario.factoryCount })),
    buildCost: mergeBuildCosts([...Array(scenario.factoryCount).fill(factory.buildCost), ...beltCosts, od.buildCost]),
  };
}
