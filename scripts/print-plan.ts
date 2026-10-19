import { factories } from "../src/domain/data/factories.data";
import { planFactory, outputRatesAt, type BeltScenario } from "../src/domain/planner/production-plan";
import { planAllMineableItems, type BeltSaturation } from "../src/domain/planner/mining-plan";
import { overdriveVariants } from "../src/domain/planner/overdrive-variants";
import { estimateProductionCost } from "../src/domain/cost-estimate/estimate-production-cost";
import { estimateMiningCost } from "../src/domain/cost-estimate/estimate-mining-cost";
import type { CostEstimate } from "../src/domain/cost-estimate/shared";

function formatCost(cost: CostEstimate): string {
  const liquid = cost.liquidDraw.length > 0 ? `, liquid: ${cost.liquidDraw.map((l) => `${l.liquidId} ${l.rate.toFixed(2)}/s`).join(", ")}` : "";
  const build = cost.buildCost.map((b) => `${b.item} x${b.amount}`).join(", ");
  return `power ${cost.powerDraw.toFixed(0)}/s${liquid}, build cost: ${build || "none"}`;
}

function formatProductionScenario(label: string, scenario: BeltScenario): string {
  if (scenario.belts.length === 0) return `    ${label}: unconstrained (no item inputs)`;
  const beltList = scenario.belts
    .map((b) => `${b.itemId}→${b.beltId}(${b.beltThroughput}/s, needs ${b.perFactoryRate.toFixed(2)}/s each)`)
    .join(", ");
  return `    ${label}: ${scenario.factoryCount} factories — ${beltList}`;
}

function formatMiningBelt(sat: BeltSaturation): string {
  const overflow = sat.overflow > 0 ? `, overflow +${sat.overflow.toFixed(2)}/s wasted` : "";
  return `${sat.drillsNeeded} drills → ${sat.achievedRate.toFixed(2)}/${sat.beltThroughput}/s (${(sat.utilization * 100).toFixed(0)}%)${overflow}`;
}

for (const variant of overdriveVariants()) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`Overdrive: ${variant.label} (x${variant.speedMultiplier} speed)`);
  if (variant.requiredInputs.length > 0) {
    console.log(`  resource draw: ${variant.requiredInputs.map((r) => `${r.itemId} ${r.rate}/s`).join(", ")}`);
  }
  console.log("=".repeat(70));

  console.log("\n-- Mining (raw item → full belt) --");
  for (const plan of planAllMineableItems(variant.speedMultiplier)) {
    console.log(`\n  ${plan.itemId}`);
    for (const option of plan.options) {
      const cooling = option.cooling.active
        ? `boosted w/ ${option.cooling.boostResourceId} @ ${option.cooling.boostConsumptionRate}/s`
        : "unboosted";
      console.log(`    ${option.drillName} (${cooling}, ${option.cooling.perDrillRate.toFixed(2)} items/s/drill)`);

      for (const [label, sat] of [
        ["regular", option.regularBelt],
        ["titanium", option.titaniumBelt],
      ] as const) {
        const cost = estimateMiningCost(option, sat, variant);
        console.log(`      ${label.padEnd(8)}: ${formatMiningBelt(sat)}`);
        console.log(`        cost: ${formatCost(cost)}`);
      }
    }
  }

  console.log("\n-- Production (factory → full belt) --");
  for (const factory of factories) {
    const plan = planFactory(factory, variant.speedMultiplier);
    console.log(`\n  ${plan.factoryName} (${plan.factoryId})`);

    if (plan.liquidInputs.length > 0) {
      console.log(`    liquid inputs (not belt-optimized): ${plan.liquidInputs.map((l) => `${l.liquidId} ${l.perFactoryRate.toFixed(2)}/s`).join(", ")}`);
    }

    for (const [label, scenario] of [
      ["all-regular  ", plan.allRegular],
      ["all-titanium ", plan.allTitanium],
      ["optimal-mixed", plan.optimalMixed],
    ] as const) {
      console.log(formatProductionScenario(label, scenario));
      const cost = estimateProductionCost(factory, plan, scenario, variant);
      console.log(`      cost: ${formatCost(cost)}`);
    }

    const outputs = outputRatesAt(factory, plan.optimalMixed.factoryCount, variant.speedMultiplier);
    console.log(`    output @ optimal-mixed: ${outputs.map((o) => `${o.id} ${o.rate.toFixed(2)}/s`).join(", ")}`);
  }
}
