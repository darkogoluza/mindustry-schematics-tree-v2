import { factories } from "../data/factories.data";
import type { ItemId, LiquidId } from "../types";

const cache = new Map<string, number>();

/**
 * How many synthesis steps separate `id` from raw ore — 0 for something minable directly (or a
 * dead end with no producer), 1 for something built straight from raw materials, and so on. Used
 * as a proxy for how "exotic" a build material is: the more processing steps behind it, the more
 * infrastructure it implicitly depends on, so a design that needs it is less self-contained.
 */
export function materialDepth(id: ItemId | LiquidId): number {
  const cached = cache.get(id);
  if (cached !== undefined) return cached;

  // Seed with 0 before recursing so a cyclical recipe (shouldn't exist in valid data, but just in
  // case) terminates instead of looping forever — the seed gets overwritten below once known.
  cache.set(id, 0);

  const producer = factories.find((f) => f.outputs.some((o) => o.id === id));
  if (!producer) return 0;

  const depth = 1 + Math.max(0, ...producer.inputs.map((input) => materialDepth(input.id)));
  cache.set(id, depth);
  return depth;
}
