import { factories } from "../data/factories.data";
import { drills } from "../data/drills.data";
import { overdrives } from "../data/overdrives.data";
import { findCatalogEntity } from "../catalog";
import type { Factory, ItemId, LiquidId } from "../types";
import { planFactory, outputRatesAt, type BeltScenario } from "./production-plan";
import { planMining, type DrillOption, type BeltSaturation } from "./mining-plan";
import { overdriveVariants, type OverdriveVariant } from "./overdrive-variants";
import { requireBelt } from "./belt-lookup";
import { estimateProductionCost } from "../cost-estimate/estimate-production-cost";
import { estimateMiningCost } from "../cost-estimate/estimate-mining-cost";
import { mergeBuildCosts, type CostEstimate, type LiquidDraw } from "../cost-estimate/shared";
import { materialDepth } from "./material-depth";

export type GraphNodeKind = "item" | "liquid" | "factory" | "drill" | "belt" | "overdrive";

export interface GraphNodeStat {
  readonly label: string;
  readonly value: string;
}

export interface GraphNode {
  readonly id: string;
  readonly label: string;
  readonly kind: GraphNodeKind;
  readonly icon: string;
  /** A second icon shown alongside the main one — e.g. a belt node shows both the conveyor and the material it carries. */
  readonly secondaryIcon?: string;
  readonly secondaryIconLabel?: string;
  readonly stats?: readonly GraphNodeStat[];
  /** Shown on this node's badge, e.g. "raw" for a mined ore. */
  readonly badge?: string;
  /** Shown on the edge connecting this node up to its parent (plain ratio/pipe rate — belts get their own node instead). */
  readonly edgeLabel?: string;
  readonly children?: readonly GraphNode[];
}

export interface CraftPermutationMetrics {
  readonly unitsNeeded: number;
  readonly outputRate: number;
  readonly powerDraw: number;
  /** Sum of all build-cost item amounts — a rough single-number stand-in for "total parts", not a real currency. */
  readonly buildCostTotal: number;
  readonly beltsUsed: number;
  /**
   * 0..1 — average, across every conveyor junction in the whole tree, of how closely matched
   * the upstream produced rate is to that belt's throughput: min(produced, capacity) / max(produced, capacity).
   * Penalizes both overflow (a drill/factory producing more than the belt can carry — wasted output)
   * and underfill (a belt carrying far less than its capacity — wasted belt). 1 = perfectly matched.
   */
  readonly efficiency: number;
  /** Total floor tiles occupied by every factory and drill in the whole tree (size² × count each, summed). Excludes conveyor belts. */
  readonly totalArea: number;
  /** The subset of totalArea that's drills specifically — they must sit on the ore patch, unlike factories which can go anywhere. */
  readonly drillArea: number;
  /**
   * Estimated units of the target item actually carried out per minute, capped at what a single
   * output belt of the scenario's type can carry (regular/titanium; "optimal-mixed" assumes
   * titanium as an upper bound, since it isn't a single declared belt type). An approximation —
   * we don't model a literal output-belt topology, just the ceiling one belt imposes.
   */
  readonly outputPerMinute: number;
  /**
   * 0..100 composite rating of the whole design — higher is better. Weighs efficiency and output
   * highest, drill area heavily (it's locked to the ore patch, unlike factories), power/water
   * moderately, total area lightly, and build-material "exoticness" (how many synthesis steps
   * separate each required material from raw ore — a proxy for how much extra infrastructure the
   * design implicitly depends on) moderately-high. See computeScore for the exact weights.
   */
  readonly score: number;
}

export interface CraftPermutation {
  readonly id: string;
  readonly label: string;
  readonly graph: GraphNode;
  /** Standalone subgraph for the active overdrive (if any) and what it draws — not wired into the main tree. */
  readonly overdriveGraph?: GraphNode;
  readonly cost: CostEstimate;
  readonly metrics: CraftPermutationMetrics;
}

export interface CraftPermutationPage {
  readonly items: readonly CraftPermutation[];
  /** Exact total under the active filters — undefined when a range filter (power/water/efficiency) makes an exact count infeasible without a full scan. */
  readonly totalCount: number | undefined;
  /** Whether more matching permutations exist beyond this page. */
  readonly hasMore: boolean;
}

/**
 * Toggle-style filters — an empty/undefined set for a group means "unrestricted" (matches
 * everything), per the UI rule that turning nothing on shows all permutations.
 */
export interface CraftFilters {
  readonly overdriveKeys?: ReadonlySet<string>;
  readonly beltLabels?: ReadonlySet<string>;
  readonly drillIds?: ReadonlySet<string>;
  readonly minPower?: number;
  readonly maxPower?: number;
  readonly minWater?: number;
  readonly maxWater?: number;
  /** 0..1 */
  readonly minEfficiency?: number;
  /** 0..1 */
  readonly maxEfficiency?: number;
}

function passesSet<T>(value: T, allowed: ReadonlySet<T> | undefined): boolean {
  return !allowed || allowed.size === 0 || allowed.has(value);
}

function hasRangeFilters(filters: CraftFilters | undefined): boolean {
  if (!filters) return false;
  return (
    filters.minPower !== undefined ||
    filters.maxPower !== undefined ||
    filters.minWater !== undefined ||
    filters.maxWater !== undefined ||
    filters.minEfficiency !== undefined ||
    filters.maxEfficiency !== undefined
  );
}

function passesRangeFilters(perm: CraftPermutation, filters: CraftFilters | undefined): boolean {
  if (!filters) return true;
  const power = perm.cost.powerDraw;
  if (filters.minPower !== undefined && power < filters.minPower) return false;
  if (filters.maxPower !== undefined && power > filters.maxPower) return false;
  const water = perm.cost.liquidDraw.find((l) => l.liquidId === "water")?.rate ?? 0;
  if (filters.minWater !== undefined && water < filters.minWater) return false;
  if (filters.maxWater !== undefined && water > filters.maxWater) return false;
  const efficiency = perm.metrics.efficiency;
  if (filters.minEfficiency !== undefined && efficiency < filters.minEfficiency) return false;
  if (filters.maxEfficiency !== undefined && efficiency > filters.maxEfficiency) return false;
  return true;
}

/** Hard cap on how many candidates a range-filtered scan will examine per page request, so a rare filter combo can't hang the UI thread. */
const RANGE_SCAN_CAP = 20000;

/** Accumulates cross-tree metrics while the graph is being built, since all three span the whole recursive tree. */
interface BuildContext {
  readonly efficiencySamples: number[];
  readonly factoryAreaSamples: number[];
  readonly drillAreaSamples: number[];
}

function createBuildContext(): BuildContext {
  return { efficiencySamples: [], factoryAreaSamples: [], drillAreaSamples: [] };
}

/**
 * A specific choice of (drill, cooling) for every raw item reachable in the tree, keyed by item id.
 * Belt type is deliberately not part of this choice: a raw item is carried from drill to consumer
 * by one continuous belt, so its type is derived from whichever belt the consuming factory already
 * chose for that input (see buildRawSupplyNode), not picked independently.
 */
type MiningCombo = ReadonlyMap<ItemId, DrillOption>;

const MAX_RECURSION_DEPTH = 8;

function entityLabel(id: string): string {
  return findCatalogEntity(id)?.name ?? id;
}

function entityIcon(id: string): string {
  return findCatalogEntity(id)?.icon ?? `/icons/${id}.png`;
}

function entityKind(id: string): "item" | "liquid" {
  return findCatalogEntity(id)?.kind === "liquid" ? "liquid" : "item";
}

function isRawItem(id: string): boolean {
  const entity = findCatalogEntity(id);
  return entity?.kind === "item" && entity.raw;
}

function isMineable(id: ItemId): boolean {
  return drills.some((d) => d.mines[id] !== undefined);
}

function buildCostTotalOf(cost: CostEstimate): number {
  return cost.buildCost.reduce((sum, entry) => sum + entry.amount, 0);
}

/**
 * Reference scales used to normalize each raw metric into a 0..1 "goodness" before weighting.
 * These are fixed engineering estimates (not derived from the live data), since permutations are
 * generated lazily and can number in the millions — there's no cheap way to normalize against the
 * true min/max across an entire space without materializing it.
 */
const SCORE_REFERENCE = {
  powerFreeUntil: 500, // power draw below this is basically free — no penalty
  powerDecay: 150, // past the free threshold, penalty decays quadratically with this as the scale — mild just past 500, very steep by ~800
  maxWater: 800, // water is cheap/plentiful — a high ceiling means realistic usage barely dents the score
  drillAreaRef: 70, // hyperbolic reference for drill area — lowered so smaller drill areas are rewarded more sharply, since it means repeating the design twice over in the same ore patch
  maxTotalArea: 800,
  maxOutputPerMinute: 600, // = titanium belt (10/s) × 60 — the natural ceiling outputPerMinute is already capped at
  maxMaterialDepth: 4,
};

/** How "better" something is, 0..1, for a metric where higher raw values are better (efficiency, output). */
function higherIsBetter(value: number, max: number): number {
  return Math.max(0, Math.min(1, value / max));
}

/** How "better" something is, 0..1, for a metric where lower raw values are better (water, total area). */
function lowerIsBetter(value: number, max: number): number {
  return 1 - higherIsBetter(value, max);
}

/**
 * Power penalty, exponential past a free threshold: draw under `powerFreeUntil` costs nothing, then
 * the score decays exponentially so it's still mild around 300 and bites hard further out.
 */
function powerScore(power: number): number {
  if (power <= SCORE_REFERENCE.powerFreeUntil) return 1;
  const over = power - SCORE_REFERENCE.powerFreeUntil;
  return Math.exp(-((over / SCORE_REFERENCE.powerDecay) ** 2));
}

/**
 * Drill-area score, hyperbolic rather than linear: halving the area lets the same ore patch host the
 * design twice over, so the value of shrinking it doesn't taper off the way a linear penalty implies.
 */
function drillAreaScore(area: number): number {
  return SCORE_REFERENCE.drillAreaRef / (SCORE_REFERENCE.drillAreaRef + area);
}

/** Weighted-average synthesis depth of a build-cost basket — how "exotic" the required materials are overall. */
function averageMaterialDepth(cost: CostEstimate): number {
  const totalAmount = cost.buildCost.reduce((sum, e) => sum + e.amount, 0);
  if (totalAmount === 0) return 0;
  const weightedDepth = cost.buildCost.reduce((sum, e) => sum + materialDepth(e.item) * e.amount, 0);
  return weightedDepth / totalAmount;
}

const SCORE_WEIGHTS = {
  efficiency: 0.15,
  output: 0.25, // matters a lot — bumped up
  power: 0.15, // expensive — bumped up
  water: 0.03, // cheap — knocked down
  drillArea: 0.3, // expensive, scarce real estate — bumped above power, smaller is rewarded harder
  totalArea: 0.02,
  material: 0.1,
} as const;

function computeScore(cost: CostEstimate, efficiency: number, outputPerMinute: number, totalArea: number, drillArea: number): number {
  const water = cost.liquidDraw.find((l) => l.liquidId === "water")?.rate ?? 0;

  const weighted =
    SCORE_WEIGHTS.efficiency * efficiency +
    SCORE_WEIGHTS.output * higherIsBetter(outputPerMinute, SCORE_REFERENCE.maxOutputPerMinute) +
    SCORE_WEIGHTS.power * powerScore(cost.powerDraw) +
    SCORE_WEIGHTS.water * lowerIsBetter(water, SCORE_REFERENCE.maxWater) +
    SCORE_WEIGHTS.drillArea * drillAreaScore(drillArea) +
    SCORE_WEIGHTS.totalArea * lowerIsBetter(totalArea, SCORE_REFERENCE.maxTotalArea) +
    SCORE_WEIGHTS.material * lowerIsBetter(averageMaterialDepth(cost), SCORE_REFERENCE.maxMaterialDepth);

  return Math.round(weighted * 100);
}

/** 1 when there's nothing to measure (e.g. a factory with no belt-carried inputs at all). */
function averageOf(samples: readonly number[]): number {
  return samples.length > 0 ? samples.reduce((sum, s) => sum + s, 0) / samples.length : 1;
}

function sumOf(samples: readonly number[]): number {
  return samples.reduce((sum, s) => sum + s, 0);
}

/** Joins a variant label with the rest of a permutation label, skipping the separator when there's no overdrive. */
function joinLabel(variantLabel: string, rest: string): string {
  return variantLabel ? `${variantLabel} · ${rest}` : rest;
}

/** Shortest possible cooling qualifier — omitted entirely when unboosted. */
function coolingSuffix(option: DrillOption): string {
  if (!option.cooling.active || !option.cooling.boostResourceId) return "";
  return ` (${entityLabel(option.cooling.boostResourceId)}-cooled)`;
}

function areaStat(size: number): GraphNodeStat {
  return { label: "Area", value: `${size * size} tiles` };
}

function factoryStats(factory: Factory): GraphNodeStat[] {
  const stats: GraphNodeStat[] = [areaStat(factory.size)];
  if (factory.note) stats.push({ label: "Note", value: factory.note });
  if (factory.craftTime > 0) stats.push({ label: "Craft time", value: `${factory.craftTime.toFixed(2)}s` });
  if (factory.power > 0) stats.push({ label: "Power", value: `${factory.power}/s` });
  return stats;
}

function requireDrill(id: string) {
  const drill = drills.find((d) => d.id === id);
  if (!drill) throw new Error(`expected drill "${id}" in drill data`);
  return drill;
}

/** Sums liquid-draw lists together, consolidating duplicate liquids into one entry. */
function mergeLiquidDraws(draws: readonly (readonly LiquidDraw[])[]): readonly LiquidDraw[] {
  const totals = new Map<LiquidId, number>();
  for (const list of draws) {
    for (const entry of list) totals.set(entry.liquidId, (totals.get(entry.liquidId) ?? 0) + entry.rate);
  }
  return [...totals.entries()].map(([liquidId, rate]) => ({ liquidId, rate }));
}

/**
 * Power/liquid/build cost of mining one raw item for a factory permutation — the drills and the
 * belt actually feeding the chosen combo, with count already saturated against that belt. Doesn't
 * include overdrive cost: the permutation's single overdrive targets the top factory, not these
 * feeder drills.
 */
function rawSupplyCost(rawItemId: ItemId, combo: MiningCombo, scenario: BeltScenario): CostEstimate {
  const chosen = scenario.belts.find((b) => b.itemId === rawItemId);
  const option = combo.get(rawItemId);
  if (!chosen || !option) return { powerDraw: 0, liquidDraw: [], buildCost: [] };

  const saturation = chosen.beltId === option.regularBelt.beltId ? option.regularBelt : option.titaniumBelt;
  const drill = requireDrill(option.drillId);
  const belt = requireBelt(chosen.beltId);

  const liquidDraw: readonly LiquidDraw[] =
    option.cooling.active && option.cooling.boostResourceId && option.cooling.boostConsumptionRate
      ? [{ liquidId: option.cooling.boostResourceId as LiquidId, rate: option.cooling.boostConsumptionRate * saturation.drillsNeeded }]
      : [];

  return {
    powerDraw: drill.power * saturation.drillsNeeded,
    liquidDraw,
    buildCost: mergeBuildCosts([...Array(saturation.drillsNeeded).fill(drill.buildCost), belt.buildCost]),
  };
}

/**
 * Recursively finds every raw, mineable item reachable from `id` — i.e. every ore that some
 * ingredient chain bottoms out at. These are exactly the items that need their own mining
 * permutations branched out, since a raw item is never a dead end.
 */
function collectRawItemIds(id: ItemId | LiquidId, found: Set<ItemId>, depth: number): void {
  if (depth >= MAX_RECURSION_DEPTH || entityKind(id) === "liquid") return;

  const producer = factories.find((f) => f.outputs.some((o) => o.id === id));
  if (!producer) {
    if (isRawItem(id) && isMineable(id as ItemId)) found.add(id as ItemId);
    return;
  }

  for (const input of producer.inputs) collectRawItemIds(input.id, found, depth + 1);
}

/** Every (drill × cooling) way to mine one raw item — belt type is derived at the point of use, not chosen here. */
function miningChoicesFor(id: ItemId): DrillOption[] {
  return [...planMining(id, 1).options];
}

function comboLabel(combo: MiningCombo): string {
  if (combo.size === 0) return "";
  return [...combo.entries()].map(([id, option]) => `${entityLabel(id)}: ${option.drillName}${coolingSuffix(option)}`).join(", ");
}

function comboKey(combo: MiningCombo): string {
  return [...combo.entries()].map(([id, option]) => `${id}=${option.drillId}:${option.cooling.active}`).join("|");
}

/** Max drills (and resulting throughput) a belt of `beltThroughput` can carry at `perDrillRate` each. */
function saturateAgainstBelt(beltThroughput: number, perDrillRate: number): { drillsNeeded: number; achievedRate: number } {
  const drillsNeeded = Math.max(1, Math.floor(beltThroughput / perDrillRate));
  return { drillsNeeded, achievedRate: Math.min(drillsNeeded * perDrillRate, beltThroughput) };
}

/**
 * Decodes a flat index into one "digit" per dimension (mixed-radix), e.g. index 37 with dims
 * [4, 3, 2] becomes [variant, scenario, rawItemChoice] — used to address one specific permutation
 * directly without ever materializing the full cartesian product (which can be enormous).
 */
function decodeMixedRadix(index: number, dims: readonly number[]): number[] {
  const digits = new Array<number>(dims.length);
  let remaining = index;
  for (let k = dims.length - 1; k >= 0; k--) {
    digits[k] = remaining % dims[k];
    remaining = Math.floor(remaining / dims[k]);
  }
  return digits;
}

function productOf(dims: readonly number[]): number {
  return dims.reduce((product, d) => product * d, 1);
}

/**
 * Wraps `child` in a belt node and records how closely matched the belt's throughput is to what's
 * actually being produced onto it — the core efficiency signal (see CraftPermutationMetrics.efficiency).
 */
function beltNode(beltId: string, producedRate: number, beltThroughput: number, child: GraphNode, ctx: BuildContext): GraphNode {
  const belt = requireBelt(beltId);
  const achievedRate = Math.min(producedRate, beltThroughput);
  ctx.efficiencySamples.push(Math.min(producedRate, beltThroughput) / Math.max(producedRate, beltThroughput));
  return {
    id: belt.id,
    label: belt.name,
    kind: "belt",
    icon: belt.icon,
    stats: [{ label: "Rate", value: `${achievedRate.toFixed(2)}/s` }],
    children: [child],
  };
}

/**
 * Builds the full drill-to-consumer supply for one raw item as a *single* belt — a raw material is
 * carried by one continuous conveyor from the ore patch to whatever needs it, so the belt here is
 * whichever one `beltId`/`beltThroughput` the consumer already chose (not a second, independently
 * picked belt). The belt node shows the material it carries instead of being a bare belt + a
 * separate raw-item node, since otherwise the drill count would be matched against a different
 * belt than the one actually feeding the consumer — i.e. the belt-mismatch bug this fixes.
 */
function buildRawSupplyNode(rawItemId: ItemId, option: DrillOption, beltId: string, beltThroughput: number, ctx: BuildContext): GraphNode {
  const { drillsNeeded, achievedRate } = saturateAgainstBelt(beltThroughput, option.cooling.perDrillRate);
  const rawProducedRate = option.cooling.perDrillRate * drillsNeeded;
  ctx.efficiencySamples.push(Math.min(rawProducedRate, beltThroughput) / Math.max(rawProducedRate, beltThroughput));

  const drillChildren: GraphNode[] = [];
  if (option.cooling.active && option.cooling.boostResourceId && option.cooling.boostConsumptionRate) {
    drillChildren.push({
      id: option.cooling.boostResourceId,
      label: entityLabel(option.cooling.boostResourceId),
      kind: entityKind(option.cooling.boostResourceId),
      icon: entityIcon(option.cooling.boostResourceId),
      edgeLabel: `${option.cooling.boostConsumptionRate}/s (pipe)`,
    });
  }

  const drill = requireDrill(option.drillId);
  ctx.drillAreaSamples.push(drill.size * drill.size * drillsNeeded);

  const drillNode: GraphNode = {
    id: option.drillId,
    label: option.drillName,
    kind: "drill",
    icon: entityIcon(option.drillId),
    stats: [
      areaStat(drill.size),
      { label: "Count", value: `${drillsNeeded}x` },
      { label: "Rate", value: `${option.cooling.perDrillRate.toFixed(2)}/s each` },
    ],
    children: drillChildren.length > 0 ? drillChildren : undefined,
  };

  const belt = requireBelt(beltId);
  return {
    id: belt.id,
    label: belt.name,
    kind: "belt",
    icon: belt.icon,
    secondaryIcon: entityIcon(rawItemId),
    secondaryIconLabel: entityLabel(rawItemId),
    stats: [
      { label: "Carries", value: entityLabel(rawItemId) },
      { label: "Rate", value: `${achievedRate.toFixed(2)}/s` },
    ],
    children: [drillNode],
  };
}

/**
 * Recursively builds the default (no overdrive, optimal-mixed) production sub-tree for one
 * item/liquid — used for every ingredient below the top permutation node, since only the
 * clicked item's own production gets varied across permutations. Dead ends (no producer) are
 * either raw ore (flagged with a badge) or, for items, routed through buildRawSupplyNode by the
 * caller before ever reaching here — see buildFactoryNode.
 */
function buildResourceNode(id: ItemId | LiquidId, edgeLabel: string | undefined, depth: number, ctx: BuildContext, combo: MiningCombo): GraphNode {
  const base = { id, label: entityLabel(id), kind: entityKind(id), icon: entityIcon(id), edgeLabel };

  if (depth >= MAX_RECURSION_DEPTH) return base;

  const producer = factories.find((f) => f.outputs.some((o) => o.id === id));
  if (!producer) {
    return { ...base, badge: isRawItem(id) ? "raw" : undefined };
  }

  const scenario = planFactory(producer, 1).optimalMixed;
  const outputRate = outputRatesAt(producer, scenario.factoryCount, 1).find((o) => o.id === id)?.rate ?? 0;
  const factoryNode = buildFactoryNode(producer, scenario, `${outputRate.toFixed(2)}/s`, depth + 1, ctx, combo);
  return { ...base, children: [factoryNode] };
}

function buildFactoryNode(
  factory: Factory,
  scenario: BeltScenario,
  edgeLabel: string | undefined,
  depth: number,
  ctx: BuildContext,
  combo: MiningCombo,
): GraphNode {
  const children = factory.inputs.map((input) => {
    if (input.type === "item") {
      const chosen = scenario.belts.find((b) => b.itemId === input.id);
      if (!chosen) return buildResourceNode(input.id, `×${input.amount}`, depth + 1, ctx, combo);

      const drillOption = combo.get(input.id);
      if (drillOption) return buildRawSupplyNode(input.id, drillOption, chosen.beltId, chosen.beltThroughput, ctx);

      const itemNode = buildResourceNode(input.id, undefined, depth + 2, ctx, combo);
      return beltNode(chosen.beltId, chosen.perFactoryRate, chosen.beltThroughput, itemNode, ctx);
    }
    return buildResourceNode(input.id, `${input.rate}/s${input.perTile ? " per tile" : ""} (pipe)`, depth + 1, ctx, combo);
  });

  ctx.factoryAreaSamples.push(factory.size * factory.size * scenario.factoryCount);

  return {
    id: factory.id,
    label: factory.name,
    kind: "factory",
    icon: entityIcon(factory.id),
    stats: [...factoryStats(factory), { label: "Count", value: `${scenario.factoryCount}x` }],
    edgeLabel,
    children: children.length > 0 ? children : undefined,
  };
}

function rootFactoryGraph(itemId: ItemId, factory: Factory, scenario: BeltScenario, outputRate: number, ctx: BuildContext, combo: MiningCombo): GraphNode {
  return {
    id: itemId,
    label: entityLabel(itemId),
    kind: "item",
    icon: entityIcon(itemId),
    children: [buildFactoryNode(factory, scenario, `${outputRate.toFixed(2)}/s`, 1, ctx, combo)],
  };
}

function rootDrillGraph(itemId: ItemId, option: DrillOption, saturation: BeltSaturation, ctx: BuildContext): GraphNode {
  return {
    id: itemId,
    label: entityLabel(itemId),
    kind: "item",
    icon: entityIcon(itemId),
    children: [buildRawSupplyNode(itemId, option, saturation.beltId, saturation.beltThroughput, ctx)],
  };
}

/** Standalone subgraph for the active overdrive and whatever it draws to stay running — not connected to the main tree. */
function buildOverdriveGraph(variant: OverdriveVariant): GraphNode | undefined {
  if (!variant.overdriveId) return undefined;
  const overdrive = overdrives.find((o) => o.id === variant.overdriveId);
  if (!overdrive) return undefined;

  const children: GraphNode[] = variant.requiredInputs.map((input) => ({
    id: input.itemId,
    label: entityLabel(input.itemId),
    kind: entityKind(input.itemId),
    icon: entityIcon(input.itemId),
    edgeLabel: `${input.rate}/s`,
  }));

  return {
    id: overdrive.id,
    label: overdrive.name,
    kind: "overdrive",
    icon: entityIcon(overdrive.id),
    stats: [
      { label: "Speed", value: `+${Math.round(overdrive.speedIncrease * 100)}%` },
      { label: "Power", value: `${overdrive.power}/s` },
    ],
    children: children.length > 0 ? children : undefined,
  };
}

const FACTORY_SCENARIOS = [
  ["all-regular conveyor", (p: ReturnType<typeof planFactory>) => p.allRegular] as const,
  ["all-titanium conveyor", (p: ReturnType<typeof planFactory>) => p.allTitanium] as const,
  ["optimal-mixed", (p: ReturnType<typeof planFactory>) => p.optimalMixed] as const,
];

function scenarioBeltLabel(scenarioLabel: string): string | undefined {
  if (scenarioLabel === "all-regular conveyor") return "regular conveyor";
  if (scenarioLabel === "all-titanium conveyor") return "titanium conveyor";
  return undefined; // "optimal-mixed" isn't a single belt type, excluded whenever a belt filter is active
}

/** The output belt's throughput ceiling for a scenario — titanium (the faster option) for "optimal-mixed" since it isn't a single declared belt type. */
function outputBeltThroughputFor(scenarioLabel: string): number {
  if (scenarioLabel === "all-regular conveyor") return requireBelt("conveyor").moveSpeed;
  return requireBelt("titanium-conveyor").moveSpeed;
}

/** Shared per-item setup so count/page queries don't redo this work and never materialize the full combination space. */
interface PermutationSpace {
  readonly producer: Factory | undefined;
  readonly variants: readonly OverdriveVariant[];
  /** Factory branch only: the (filtered) scenario list and one (filtered) choice-list per raw item reachable in the tree. */
  readonly scenarios: readonly (typeof FACTORY_SCENARIOS)[number][];
  readonly rawItemIds: readonly ItemId[];
  readonly choiceLists: readonly DrillOption[][];
  /** Drill branch only: every (filtered) option for the clicked item itself, and the (filtered) belt labels available. */
  readonly drillOptions: readonly DrillOption[];
  readonly beltChoices: readonly string[];
  readonly dims: readonly number[];
  readonly totalCount: number;
}

function buildPermutationSpace(itemId: ItemId, filters: CraftFilters | undefined): PermutationSpace {
  const producer = factories.find((f) => f.outputs.some((o) => o.type === "item" && o.id === itemId));
  const variants = overdriveVariants().filter((v) => passesSet(v.key, filters?.overdriveKeys));

  if (producer) {
    const rawIds = new Set<ItemId>();
    collectRawItemIds(itemId, rawIds, 0);
    const rawItemIds = [...rawIds];
    const choiceLists = rawItemIds.map((id) => miningChoicesFor(id).filter((option) => passesSet(option.drillId, filters?.drillIds)));
    const scenarios = FACTORY_SCENARIOS.filter(([label]) => {
      const belt = scenarioBeltLabel(label);
      return belt ? passesSet(belt, filters?.beltLabels) : !filters?.beltLabels || filters.beltLabels.size === 0;
    });
    const dims = [variants.length, scenarios.length, ...choiceLists.map((c) => c.length)];
    return { producer, variants, scenarios, rawItemIds, choiceLists, drillOptions: [], beltChoices: [], dims, totalCount: productOf(dims) };
  }

  const drillOptions = planMining(itemId, 1).options.filter((o) => passesSet(o.drillId, filters?.drillIds));
  const beltChoices = (["regular conveyor", "titanium conveyor"] as const).filter((b) => passesSet(b, filters?.beltLabels));
  const dims = [variants.length, drillOptions.length, beltChoices.length];
  return {
    producer: undefined,
    variants,
    scenarios: [],
    rawItemIds: [],
    choiceLists: [],
    drillOptions,
    beltChoices,
    dims,
    totalCount: productOf(dims),
  };
}

function buildPermutationAt(itemId: ItemId, space: PermutationSpace, index: number): CraftPermutation {
  if (space.producer) {
    const [variantIdx, scenarioIdx, ...choiceIdx] = decodeMixedRadix(index, space.dims);
    const variant = space.variants[variantIdx];
    const [scenarioLabel, pick] = space.scenarios[scenarioIdx];
    const combo: MiningCombo = new Map(space.rawItemIds.map((id, i) => [id, space.choiceLists[i][choiceIdx[i]]]));

    const plan = planFactory(space.producer, variant.speedMultiplier);
    const overdriveGraph = buildOverdriveGraph(variant);
    const scenario = pick(plan);
    const outputRate = outputRatesAt(space.producer, scenario.factoryCount, variant.speedMultiplier).find((o) => o.id === itemId)?.rate ?? 0;
    const productionCost = estimateProductionCost(space.producer, plan, scenario, variant);
    const miningCosts = space.rawItemIds.map((id) => rawSupplyCost(id, combo, scenario));
    const cost: CostEstimate = {
      powerDraw: productionCost.powerDraw + sumOf(miningCosts.map((m) => m.powerDraw)),
      liquidDraw: mergeLiquidDraws([productionCost.liquidDraw, ...miningCosts.map((m) => m.liquidDraw)]),
      buildCost: mergeBuildCosts([productionCost.buildCost, ...miningCosts.map((m) => m.buildCost)]),
    };
    const ctx = createBuildContext();
    const graph = rootFactoryGraph(itemId, space.producer, scenario, outputRate, ctx, combo);
    const outputPerMinute = Math.min(outputRate, outputBeltThroughputFor(scenarioLabel)) * 60;

    const efficiency = averageOf(ctx.efficiencySamples);
    const totalArea = sumOf(ctx.factoryAreaSamples) + sumOf(ctx.drillAreaSamples);
    const drillArea = sumOf(ctx.drillAreaSamples);

    return {
      id: `${variant.label}:${scenarioLabel}:${comboKey(combo)}`,
      label: joinLabel(variant.label, [scenarioLabel, comboLabel(combo)].filter(Boolean).join(" · ")),
      graph,
      overdriveGraph,
      cost,
      metrics: {
        unitsNeeded: scenario.factoryCount,
        outputRate,
        powerDraw: cost.powerDraw,
        buildCostTotal: buildCostTotalOf(cost),
        beltsUsed: scenario.belts.length,
        efficiency,
        totalArea,
        drillArea,
        outputPerMinute,
        score: computeScore(cost, efficiency, outputPerMinute, totalArea, drillArea),
      },
    };
  }

  const [variantIdx, optionIdx, beltIdx] = decodeMixedRadix(index, space.dims);
  const variant = space.variants[variantIdx];
  const option = space.drillOptions[optionIdx];
  const beltLabel = space.beltChoices[beltIdx];
  const saturation = beltLabel === "regular conveyor" ? option.regularBelt : option.titaniumBelt;

  const overdriveGraph = buildOverdriveGraph(variant);
  const cost = estimateMiningCost(option, saturation, variant);
  const ctx = createBuildContext();
  const graph = rootDrillGraph(itemId, option, saturation, ctx);

  const drillEfficiency = averageOf(ctx.efficiencySamples);
  const drillTotalArea = sumOf(ctx.factoryAreaSamples) + sumOf(ctx.drillAreaSamples);
  const drillAreaTotal = sumOf(ctx.drillAreaSamples);
  // saturation.achievedRate is already capped at this belt's throughput, so no further capping needed.
  const drillOutputPerMinute = saturation.achievedRate * 60;

  return {
    id: `${variant.label}:${option.drillId}:${option.cooling.active}:${beltLabel}`,
    label: joinLabel(variant.label, `${option.drillName}${coolingSuffix(option)} · ${beltLabel}`),
    graph,
    overdriveGraph,
    cost,
    metrics: {
      unitsNeeded: saturation.drillsNeeded,
      outputRate: saturation.achievedRate,
      powerDraw: cost.powerDraw,
      buildCostTotal: buildCostTotalOf(cost),
      beltsUsed: 1,
      efficiency: drillEfficiency,
      totalArea: drillTotalArea,
      drillArea: drillAreaTotal,
      outputPerMinute: drillOutputPerMinute,
      score: computeScore(cost, drillEfficiency, drillOutputPerMinute, drillTotalArea, drillAreaTotal),
    },
  };
}

/**
 * Total number of permutations for `itemId` under the given structural filters (overdrive/belt/drill) —
 * cheap, just multiplies option-list sizes, never enumerates. Returns undefined if range filters
 * (power/water/efficiency) are active, since an exact count would require a full scan.
 */
export function getCraftPermutationCount(itemId: ItemId, filters?: CraftFilters): number | undefined {
  if (hasRangeFilters(filters)) return undefined;
  return buildPermutationSpace(itemId, filters).totalCount;
}

/**
 * One page of permutations for `itemId` matching `filters`, ranked by score (highest first).
 * Ranking requires examining candidates (score can't be known without building them), so this
 * scans forward from the start of the structurally-filtered space, capped at RANGE_SCAN_CAP
 * candidates — cheap and exact whenever the space fits under the cap, and a deterministic
 * best-effort (ranked among the first N candidates in index order, not the true global best)
 * when it doesn't. `totalCount` is only exact when the scan covered the entire space.
 */
export function getCraftPermutationsPage(itemId: ItemId, pageIndex: number, pageSize: number, filters?: CraftFilters): CraftPermutationPage {
  const space = buildPermutationSpace(itemId, filters);
  const scanLimit = Math.min(space.totalCount, RANGE_SCAN_CAP);
  const scannedEverything = space.totalCount <= RANGE_SCAN_CAP;

  const matches: CraftPermutation[] = [];
  for (let i = 0; i < scanLimit; i++) {
    const candidate = buildPermutationAt(itemId, space, i);
    if (passesRangeFilters(candidate, filters)) matches.push(candidate);
  }
  matches.sort((a, b) => b.metrics.score - a.metrics.score);

  const start = Math.max(0, pageIndex) * pageSize;
  const items = matches.slice(start, start + pageSize);
  const hasMore = start + pageSize < matches.length;

  return { items, totalCount: scannedEverything ? matches.length : undefined, hasMore };
}

export type { OverdriveVariant };
