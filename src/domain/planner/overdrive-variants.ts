import { overdrives } from "../data/overdrives.data";
import type { OverdriveInput } from "../types";

export interface OverdriveVariant {
  readonly label: string;
  /** Stable identifier for filtering — unlike label, never changes shape (e.g. "none", "overdrive-projector", "overdrive-projector:phase-fabric"). */
  readonly key: string;
  /** Total multiplier applied to craft/mine rates, e.g. 1.5 for +50%. */
  readonly speedMultiplier: number;
  /** Continuous item draw needed to sustain this variant (empty if none). */
  readonly requiredInputs: readonly OverdriveInput[];
  /** Source overdrive id, for cost lookups (power draw, build cost) — undefined for "none". */
  readonly overdriveId?: string;
}

/**
 * One overdrive is assumed to cover the entire plan (no range/tiling math), so this just
 * enumerates every way to configure it: no overdrive, each overdrive at its base rate, and
 * each optional booster stacked on top.
 */
export function overdriveVariants(): readonly OverdriveVariant[] {
  const variants: OverdriveVariant[] = [{ label: "", key: "none", speedMultiplier: 1, requiredInputs: [] }];

  for (const od of overdrives) {
    variants.push({ label: od.name, key: od.id, speedMultiplier: 1 + od.speedIncrease, requiredInputs: od.requiredInputs, overdriveId: od.id });

    if (od.booster) {
      variants.push({
        label: `${od.name} (${od.booster.itemId})`,
        key: `${od.id}:${od.booster.itemId}`,
        speedMultiplier: 1 + od.speedIncrease + od.booster.bonusSpeedIncrease,
        requiredInputs: [...od.requiredInputs, { itemId: od.booster.itemId, rate: od.booster.rate }],
        overdriveId: od.id,
      });
    }
  }

  return variants;
}
