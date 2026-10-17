import { overdrives } from "./data/overdrives.data";
import type { OverdriveInput } from "./types";

export interface OverdriveVariant {
  readonly label: string;
  /** Total multiplier applied to craft/mine rates, e.g. 1.5 for +50%. */
  readonly speedMultiplier: number;
  /** Continuous item draw needed to sustain this variant (empty if none). */
  readonly requiredInputs: readonly OverdriveInput[];
}

/**
 * One overdrive is assumed to cover the entire plan (no range/tiling math), so this just
 * enumerates every way to configure it: no overdrive, each overdrive at its base rate, and
 * each optional booster stacked on top.
 */
export function overdriveVariants(): readonly OverdriveVariant[] {
  const variants: OverdriveVariant[] = [{ label: "none", speedMultiplier: 1, requiredInputs: [] }];

  for (const od of overdrives) {
    variants.push({ label: od.name, speedMultiplier: 1 + od.speedIncrease, requiredInputs: od.requiredInputs });

    if (od.booster) {
      variants.push({
        label: `${od.name} (boosted w/ ${od.booster.itemId})`,
        speedMultiplier: 1 + od.speedIncrease + od.booster.bonusSpeedIncrease,
        requiredInputs: [...od.requiredInputs, { itemId: od.booster.itemId, rate: od.booster.rate }],
      });
    }
  }

  return variants;
}
