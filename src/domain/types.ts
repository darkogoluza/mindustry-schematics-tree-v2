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
