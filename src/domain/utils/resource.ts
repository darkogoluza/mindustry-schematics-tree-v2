import type { BuildCostEntry, Boost, FlowEntry, ItemId, LiquidId } from "../types";

/** Curried: cost("copper")(75) */
export const cost =
  (item: ItemId) =>
  (amount: number): BuildCostEntry => ({ item, amount });

/** Curried: itemFlow("coal")(2) */
export const itemFlow =
  (id: ItemId) =>
  (amount: number): FlowEntry => ({ type: "item", id, amount });

/** Curried: liquidFlow("oil")(15) or liquidFlow("water")(7, { perTile: true }) */
export const liquidFlow =
  (id: LiquidId) =>
  (rate: number, opts?: { perTile?: boolean }): FlowEntry => ({
    type: "liquid",
    id,
    rate,
    ...(opts?.perTile ? { perTile: true } : {}),
  });

/** Curried: boost("water")("liquid")(3.5)(2.56) */
export const boost =
  (id: ItemId | LiquidId) =>
  (type: "item" | "liquid") =>
  (rate: number) =>
  (multiplier: number): Boost => {
    if (rate <= 0) throw new Error(`boost rate must be > 0, got ${rate}`);
    if (multiplier <= 0) throw new Error(`boost multiplier must be > 0, got ${multiplier}`);
    return { type, id, rate, multiplier };
  };
