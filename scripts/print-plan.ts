import { factories } from "../src/domain/data/factories.data";
import { planFactory, outputRatesAt, type BeltScenario } from "../src/domain/production-plan";
import { planAllMineableItems, type BeltSaturation, type DrillOption } from "../src/domain/mining-plan";
import { overdriveVariants } from "../src/domain/overdrive-variants";

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

function formatMiningOption(opt: DrillOption): string {
  const cooling = opt.cooling.active
    ? `boosted w/ ${opt.cooling.boostResourceId} @ ${opt.cooling.boostConsumptionRate}/s`
    : "unboosted";
  return [
    `    ${opt.drillName} (${cooling}, ${opt.cooling.perDrillRate.toFixed(2)} items/s/drill)`,
    `      regular : ${formatMiningBelt(opt.regularBelt)}`,
    `      titanium: ${formatMiningBelt(opt.titaniumBelt)}`,
  ].join("\n");
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
    for (const option of plan.options) console.log(formatMiningOption(option));
  }

  console.log("\n-- Production (factory → full belt) --");
  for (const factory of factories) {
    const plan = planFactory(factory, variant.speedMultiplier);
    console.log(`\n  ${plan.factoryName} (${plan.factoryId})`);

    if (plan.liquidInputs.length > 0) {
      console.log(`    liquid inputs (not belt-optimized): ${plan.liquidInputs.map((l) => `${l.liquidId} ${l.perFactoryRate.toFixed(2)}/s`).join(", ")}`);
    }

    console.log(formatProductionScenario("all-regular  ", plan.allRegular));
    console.log(formatProductionScenario("all-titanium ", plan.allTitanium));
    console.log(formatProductionScenario("optimal-mixed", plan.optimalMixed));

    const outputs = outputRatesAt(factory, plan.optimalMixed.factoryCount, variant.speedMultiplier);
    console.log(`    output @ optimal-mixed: ${outputs.map((o) => `${o.id} ${o.rate.toFixed(2)}/s`).join(", ")}`);
  }
}
