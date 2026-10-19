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
import type { CostEstimate } from "../cost-estimate/shared";

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

/** One way to mine a specific raw item — a (drill, cooling, belt type) combination. */
interface MiningChoice {
  readonly option: DrillOption;
  readonly beltLabel: string;
  readonly saturation: BeltSaturation;
}

/** A specific choice of how to mine every raw item reachable in the tree, keyed by item id. */
type MiningCombo = ReadonlyMap<ItemId, MiningChoice>;

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

/** Every (drill × cooling × belt type) way to mine one raw item. */
function miningChoicesFor(id: ItemId): MiningChoice[] {
  const plan = planMining(id, 1);
  const choices: MiningChoice[] = [];
  for (const option of plan.options) {
    choices.push({ option, beltLabel: "regular conveyor", saturation: option.regularBelt });
    choices.push({ option, beltLabel: "titanium conveyor", saturation: option.titaniumBelt });
  }
  return choices;
}

function comboLabel(combo: MiningCombo): string {
  if (combo.size === 0) return "";
  return [...combo.entries()]
    .map(([id, choice]) => `${entityLabel(id)}: ${choice.option.drillName}${coolingSuffix(choice.option)} · ${choice.beltLabel}`)
    .join(", ");
}

function comboKey(combo: MiningCombo): string {
  return [...combo.entries()].map(([id, c]) => `${id}=${c.option.drillId}:${c.option.cooling.active}:${c.beltLabel}`).join("|");
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

/** Builds a drill node (and its optional cooling-liquid child) for one mining choice, tracking its ore-patch area. */
function buildDrillNode(option: DrillOption, saturation: BeltSaturation, ctx: BuildContext): GraphNode {
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
  ctx.drillAreaSamples.push(drill.size * drill.size * saturation.drillsNeeded);

  return {
    id: option.drillId,
    label: option.drillName,
    kind: "drill",
    icon: entityIcon(option.drillId),
    stats: [
      areaStat(drill.size),
      { label: "Count", value: `${saturation.drillsNeeded}x` },
      { label: "Rate", value: `${option.cooling.perDrillRate.toFixed(2)}/s each` },
    ],
    children: drillChildren.length > 0 ? drillChildren : undefined,
  };
}

/**
 * Recursively builds the default (no overdrive, optimal-mixed) production sub-tree for one
 * item/liquid — used for every ingredient below the top permutation node, since only the
 * clicked item's own production gets varied across permutations. Raw items branch into the
 * mining choice selected for them in `combo` instead of terminating as a flat "raw" leaf.
 */
function buildResourceNode(id: ItemId | LiquidId, edgeLabel: string | undefined, depth: number, ctx: BuildContext, combo: MiningCombo): GraphNode {
  const base = { id, label: entityLabel(id), kind: entityKind(id), icon: entityIcon(id), edgeLabel };

  if (depth >= MAX_RECURSION_DEPTH) return base;

  const producer = factories.find((f) => f.outputs.some((o) => o.id === id));
  if (!producer) {
    const choice = entityKind(id) === "item" ? combo.get(id as ItemId) : undefined;
    if (choice) {
      const drillNode = buildDrillNode(choice.option, choice.saturation, ctx);
      const rawProducedRate = choice.option.cooling.perDrillRate * choice.saturation.drillsNeeded;
      return { ...base, children: [beltNode(choice.saturation.beltId, rawProducedRate, choice.saturation.beltThroughput, drillNode, ctx)] };
    }
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
      const itemNode = buildResourceNode(input.id, chosen ? undefined : `×${input.amount}`, depth + (chosen ? 2 : 1), ctx, combo);
      return chosen ? beltNode(chosen.beltId, chosen.perFactoryRate, chosen.beltThroughput, itemNode, ctx) : itemNode;
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
  const drillNode = buildDrillNode(option, saturation, ctx);
  const rawProducedRate = option.cooling.perDrillRate * saturation.drillsNeeded;

  return {
    id: itemId,
    label: entityLabel(itemId),
    kind: "item",
    icon: entityIcon(itemId),
    children: [beltNode(saturation.beltId, rawProducedRate, saturation.beltThroughput, drillNode, ctx)],
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

/** Shared per-item setup so count/page queries don't redo this work and never materialize the full combination space. */
interface PermutationSpace {
  readonly producer: Factory | undefined;
  readonly variants: readonly OverdriveVariant[];
  /** Factory branch only: the (filtered) scenario list and one (filtered) choice-list per raw item reachable in the tree. */
  readonly scenarios: readonly (typeof FACTORY_SCENARIOS)[number][];
  readonly rawItemIds: readonly ItemId[];
  readonly choiceLists: readonly MiningChoice[][];
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
    const choiceLists = rawItemIds.map((id) =>
      miningChoicesFor(id).filter((c) => passesSet(c.beltLabel, filters?.beltLabels) && passesSet(c.option.drillId, filters?.drillIds)),
    );
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
    const cost = estimateProductionCost(space.producer, plan, scenario, variant);
    const ctx = createBuildContext();
    const graph = rootFactoryGraph(itemId, space.producer, scenario, outputRate, ctx, combo);

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
        efficiency: averageOf(ctx.efficiencySamples),
        totalArea: sumOf(ctx.factoryAreaSamples) + sumOf(ctx.drillAreaSamples),
        drillArea: sumOf(ctx.drillAreaSamples),
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
      efficiency: averageOf(ctx.efficiencySamples),
      totalArea: sumOf(ctx.factoryAreaSamples) + sumOf(ctx.drillAreaSamples),
      drillArea: sumOf(ctx.drillAreaSamples),
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
 * One page of permutations for `itemId` matching `filters`. Structural filters (overdrive/belt/drill)
 * shrink the addressable space itself, so they cost nothing extra. Range filters (power/water/
 * efficiency) can only be checked after building a candidate, so that case lazily scans forward
 * from the start, skipping non-matches, capped at RANGE_SCAN_CAP candidates so a rare filter
 * combination can't hang the UI thread — `hasMore` reflects whether the cap was hit before filling
 * the page, in which case the result may be incomplete.
 */
export function getCraftPermutationsPage(itemId: ItemId, pageIndex: number, pageSize: number, filters?: CraftFilters): CraftPermutationPage {
  const space = buildPermutationSpace(itemId, filters);

  if (!hasRangeFilters(filters)) {
    const start = Math.max(0, pageIndex) * pageSize;
    const end = Math.min(space.totalCount, start + pageSize);
    const items: CraftPermutation[] = [];
    for (let i = start; i < end; i++) items.push(buildPermutationAt(itemId, space, i));
    return { items, totalCount: space.totalCount, hasMore: end < space.totalCount };
  }

  const targetSkip = Math.max(0, pageIndex) * pageSize;
  const items: CraftPermutation[] = [];
  let matched = 0;
  let scanned = 0;
  let i = 0;
  for (; i < space.totalCount && scanned < RANGE_SCAN_CAP; i++, scanned++) {
    const candidate = buildPermutationAt(itemId, space, i);
    if (!passesRangeFilters(candidate, filters)) continue;
    if (matched >= targetSkip && items.length < pageSize) items.push(candidate);
    matched++;
    if (items.length >= pageSize) {
      // Peek for at least one more match to know if there's a next page, without an unbounded extra scan.
      for (i++; i < space.totalCount && scanned < RANGE_SCAN_CAP; i++, scanned++) {
        if (passesRangeFilters(buildPermutationAt(itemId, space, i), filters)) return { items, totalCount: undefined, hasMore: true };
      }
      break;
    }
  }

  return { items, totalCount: undefined, hasMore: false };
}

export type { OverdriveVariant };
