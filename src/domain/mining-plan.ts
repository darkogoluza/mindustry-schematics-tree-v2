import type { ItemId, LiquidId } from "./types";
import { drills } from "./data/drills.data";
import { requireBelt } from "./utils/belt-lookup";

export interface CoolingOption {
  /** false = base mining rate; true = boosted (e.g. water-cooled, or graphite-fed for crushers). */
  readonly active: boolean;
  readonly boostResourceId?: ItemId | LiquidId;
  readonly boostConsumptionRate?: number;
  readonly perDrillRate: number;
}

export interface BeltSaturation {
  readonly beltId: string;
  readonly beltThroughput: number;
  /** Max drills whose combined output doesn't exceed belt throughput — at least 1, even if that single drill overflows it. */
  readonly drillsNeeded: number;
  /** What the belt actually carries, capped at its throughput. */
  readonly achievedRate: number;
  /** Capped at 1 (100%). */
  readonly utilization: number;
  /** Raw output beyond belt throughput, wasted when a single drill alone already outproduces the belt. */
  readonly overflow: number;
}

export interface DrillOption {
  readonly drillId: string;
  readonly drillName: string;
  readonly cooling: CoolingOption;
  readonly regularBelt: BeltSaturation;
  readonly titaniumBelt: BeltSaturation;
}

export interface MiningPlan {
  readonly itemId: ItemId;
  readonly options: readonly DrillOption[];
}

const cache = new Map<string, MiningPlan>();

function saturate(beltId: string, beltThroughput: number, perDrillRate: number): BeltSaturation {
  const drillsNeeded = Math.max(1, Math.floor(beltThroughput / perDrillRate));
  const rawRate = drillsNeeded * perDrillRate;
  const achievedRate = Math.min(rawRate, beltThroughput);
  const overflow = Math.max(0, rawRate - beltThroughput);
  return { beltId, beltThroughput, drillsNeeded, achievedRate, utilization: achievedRate / beltThroughput, overflow };
}

/**
 * Enumerates every (drill, cooling) combination able to mine `itemId`, each scored against both
 * belt types. Cached per (item, speedMultiplier) pair.
 * @param speedMultiplier Overdrive speed bonus as a multiplier (1 = no overdrive, 1.5 = +50%, etc).
 */
export function planMining(itemId: ItemId, speedMultiplier = 1): MiningPlan {
  const cacheKey = `${itemId}:${speedMultiplier}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const regularBelt = requireBelt("conveyor");
  const titaniumBelt = requireBelt("titanium-conveyor");

  const options: DrillOption[] = [];

  for (const drill of drills) {
    const baseRate = drill.mines[itemId];
    if (baseRate === undefined) continue;

    const unboostedRate = baseRate * speedMultiplier;
    const unboosted: CoolingOption = { active: false, perDrillRate: unboostedRate };
    options.push({
      drillId: drill.id,
      drillName: drill.name,
      cooling: unboosted,
      regularBelt: saturate(regularBelt.id, regularBelt.moveSpeed, unboostedRate),
      titaniumBelt: saturate(titaniumBelt.id, titaniumBelt.moveSpeed, unboostedRate),
    });

    if (drill.boost) {
      const boostedRate = baseRate * drill.boost.multiplier * speedMultiplier;
      const boosted: CoolingOption = {
        active: true,
        boostResourceId: drill.boost.id,
        boostConsumptionRate: drill.boost.rate,
        perDrillRate: boostedRate,
      };
      options.push({
        drillId: drill.id,
        drillName: drill.name,
        cooling: boosted,
        regularBelt: saturate(regularBelt.id, regularBelt.moveSpeed, boostedRate),
        titaniumBelt: saturate(titaniumBelt.id, titaniumBelt.moveSpeed, boostedRate),
      });
    }
  }

  const plan: MiningPlan = { itemId, options };
  cache.set(cacheKey, plan);
  return plan;
}

/** Every item any drill can mine, each planned (and cached). */
export function planAllMineableItems(speedMultiplier = 1): readonly MiningPlan[] {
  const itemIds = new Set<ItemId>();
  for (const drill of drills) {
    for (const id of Object.keys(drill.mines) as ItemId[]) itemIds.add(id);
  }
  return [...itemIds].map((id) => planMining(id, speedMultiplier));
}

export function clearMiningPlanCache(): void {
  cache.clear();
}
