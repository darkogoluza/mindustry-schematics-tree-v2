export const ITEM_IDS = [
  "copper",
  "lead",
  "metaglass",
  "graphite",
  "sand",
  "coal",
  "titanium",
  "thorium",
  "scrap",
  "silicon",
  "plastanium",
  "phase-fabric",
  "surge-alloy",
  "spore-pod",
  "blast-compound",
  "pyratite",
] as const;

export const LIQUID_IDS = ["water", "slag", "oil", "cryofluid"] as const;

export type ItemId = (typeof ITEM_IDS)[number];
export type LiquidId = (typeof LIQUID_IDS)[number];
