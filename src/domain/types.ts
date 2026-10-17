import type { ItemId, LiquidId } from "./ids";

export type { ItemId, LiquidId } from "./ids";

/** Mutable, partial draft of a built entity — used internally by builders. */
export type Draft<T> = { -readonly [K in keyof T]?: T[K] };

export interface BuildCostEntry {
  readonly item: ItemId;
  readonly amount: number;
}

export interface ItemFlowEntry {
  readonly type: "item";
  readonly id: ItemId;
  readonly amount: number;
}

export interface LiquidFlowEntry {
  readonly type: "liquid";
  readonly id: LiquidId;
  readonly rate: number;
  readonly perTile?: boolean;
}

export type FlowEntry = ItemFlowEntry | LiquidFlowEntry;

export interface Boost {
  readonly type: "item" | "liquid";
  readonly id: ItemId | LiquidId;
  readonly rate: number;
  readonly multiplier: number;
}

export interface Item {
  readonly id: ItemId;
  readonly name: string;
  readonly icon: string;
  readonly color: string;
  readonly raw: boolean;
  readonly hardness: number;
  readonly cost: number;
  readonly flammability: number;
  readonly explosiveness: number;
  readonly radioactivity: number;
  readonly charge: number;
}

export interface Liquid {
  readonly id: LiquidId;
  readonly name: string;
  readonly icon: string;
  readonly color: string;
}

export interface Factory {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly size: number;
  readonly power: number;
  readonly craftTime: number;
  readonly heatRequired: number;
  readonly note?: string;
  readonly buildCost: readonly BuildCostEntry[];
  readonly inputs: readonly FlowEntry[];
  readonly outputs: readonly FlowEntry[];
}

export interface Drill {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly size: number;
  readonly power: number;
  readonly note?: string;
  readonly buildCost: readonly BuildCostEntry[];
  readonly boost?: Boost;
  readonly mines: Readonly<Partial<Record<ItemId, number>>>;
}

export interface Belt {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly size: number;
  readonly health: number;
  readonly buildTime: number;
  readonly buildCost: readonly BuildCostEntry[];
  readonly itemCapacity: number;
  /** Throughput in items/second. */
  readonly moveSpeed: number;
}

/** A continuous item draw (not a per-craft amount) — e.g. what an Overdrive Dome needs to keep running. */
export interface OverdriveInput {
  readonly itemId: ItemId;
  readonly rate: number;
}

export interface OverdriveBooster {
  readonly itemId: ItemId;
  readonly rate: number;
  /** Additive, stacks on top of the overdrive's base speedIncrease. */
  readonly bonusSpeedIncrease: number;
  readonly bonusRange: number;
}

export interface Overdrive {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly size: number;
  readonly health: number;
  readonly power: number;
  readonly buildTime: number;
  readonly buildCost: readonly BuildCostEntry[];
  readonly itemCapacity: number;
  /** Additive speed bonus, e.g. 0.5 for +50%. */
  readonly speedIncrease: number;
  readonly range: number;
  /** Items the overdrive continuously needs just to stay active (empty for the Projector). */
  readonly requiredInputs: readonly OverdriveInput[];
  /** Optional item draw that further boosts speed/range beyond the base (Projector only). */
  readonly booster?: OverdriveBooster;
}
