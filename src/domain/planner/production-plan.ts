import type { Belt, Factory, ItemId, LiquidId } from "../types";
import { requireBelt } from "./belt-lookup";

export interface BeltChoice {
  readonly itemId: ItemId;
  readonly perFactoryRate: number;
  readonly beltId: string;
  readonly beltThroughput: number;
}

export interface BeltScenario {
  /** Number of factories this scenario can run at full throughput without starving on any input. */
  readonly factoryCount: number;
  readonly belts: readonly BeltChoice[];
}

export interface LiquidRequirement {
  readonly liquidId: LiquidId;
  readonly perFactoryRate: number;
}

export interface ProductionPlan {
  readonly factoryId: string;
  readonly factoryName: string;
  readonly itemInputCount: number;
  readonly liquidInputs: readonly LiquidRequirement[];
  readonly allRegular: BeltScenario;
  readonly allTitanium: BeltScenario;
  /** Same factory count as allTitanium, but uses titanium belts only where a regular belt would bottleneck. */
  readonly optimalMixed: BeltScenario;
}

export interface OutputRate {
  readonly id: ItemId | LiquidId;
  readonly rate: number;
}

/**
 * For a given belt throughput, how many factories consuming `perFactoryRate` each can run
 * at full speed without starving — i.e. floor division. Any supply surplus simply queues on
 * the belt; it isn't wasted, it just isn't needed by this input at this factory count.
 */
function maxFactoriesFor(beltThroughput: number, perFactoryRate: number): number {
  return Math.floor(beltThroughput / perFactoryRate);
}

/**
 * @param speedMultiplier Overdrive speed bonus as a multiplier (1 = no overdrive, 1.5 = +50%, etc).
 * Scales both consumption and production rates together, since it speeds up the whole craft cycle.
 */
export function planFactory(factory: Factory, speedMultiplier = 1): ProductionPlan {
  const regularBelt = requireBelt("conveyor");
  const titaniumBelt = requireBelt("titanium-conveyor");

  const itemInputs = factory.inputs
    .filter((e) => e.type === "item")
    .map((e) => ({ itemId: e.id, perFactoryRate: (e.amount / factory.craftTime) * speedMultiplier }));

  const liquidInputs: LiquidRequirement[] = factory.inputs
    .filter((e) => e.type === "liquid")
    .map((e) => ({ liquidId: e.id, perFactoryRate: e.rate * speedMultiplier }));

  if (itemInputs.length === 0) {
    const trivial: BeltScenario = { factoryCount: 1, belts: [] };
    return {
      factoryId: factory.id,
      factoryName: factory.name,
      itemInputCount: 0,
      liquidInputs,
      allRegular: trivial,
      allTitanium: trivial,
      optimalMixed: trivial,
    };
  }

  const regularCaps = itemInputs.map((i) => maxFactoriesFor(regularBelt.moveSpeed, i.perFactoryRate));
  const titaniumCaps = itemInputs.map((i) => maxFactoriesFor(titaniumBelt.moveSpeed, i.perFactoryRate));

  const nAllRegular = Math.min(...regularCaps);
  const nAllTitanium = Math.min(...titaniumCaps);

  const toScenario = (factoryCount: number, belt: Belt): BeltScenario => ({
    factoryCount,
    belts: itemInputs.map((i) => ({ itemId: i.itemId, perFactoryRate: i.perFactoryRate, beltId: belt.id, beltThroughput: belt.moveSpeed })),
  });

  const mixedBelts: BeltChoice[] = itemInputs.map((input, idx) => {
    const needsTitanium = regularCaps[idx] < nAllTitanium;
    const chosen = needsTitanium ? titaniumBelt : regularBelt;
    return { itemId: input.itemId, perFactoryRate: input.perFactoryRate, beltId: chosen.id, beltThroughput: chosen.moveSpeed };
  });

  return {
    factoryId: factory.id,
    factoryName: factory.name,
    itemInputCount: itemInputs.length,
    liquidInputs,
    allRegular: toScenario(nAllRegular, regularBelt),
    allTitanium: toScenario(nAllTitanium, titaniumBelt),
    optimalMixed: { factoryCount: nAllTitanium, belts: mixedBelts },
  };
}

export function planAllFactories(factories: readonly Factory[], speedMultiplier = 1): readonly ProductionPlan[] {
  return factories.map((f) => planFactory(f, speedMultiplier));
}

/** Output rates (items/s or liquid units/s) achieved by running `factoryCount` factories. */
export function outputRatesAt(factory: Factory, factoryCount: number, speedMultiplier = 1): readonly OutputRate[] {
  return factory.outputs.map((o) =>
    o.type === "item"
      ? { id: o.id, rate: (o.amount * factoryCount * speedMultiplier) / factory.craftTime }
      : { id: o.id, rate: o.rate * factoryCount * speedMultiplier },
  );
}
