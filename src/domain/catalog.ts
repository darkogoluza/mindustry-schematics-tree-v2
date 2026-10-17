import { items } from "./data/items.data";
import { liquids } from "./data/liquids.data";
import { factories } from "./data/factories.data";
import { drills } from "./data/drills.data";
import type { Item, Liquid, Factory, Drill } from "./types";

export type CatalogKind = "item" | "liquid" | "factory" | "drill";

export type CatalogEntity =
  | (Item & { readonly kind: "item" })
  | (Liquid & { readonly kind: "liquid" })
  | (Factory & { readonly kind: "factory" })
  | (Drill & { readonly kind: "drill" });

export const CATALOG_KIND_LABEL: Record<CatalogKind, string> = {
  item: "Item",
  liquid: "Liquid",
  factory: "Factory",
  drill: "Drill",
};

export const CATALOG_KIND_LABEL_PLURAL: Record<CatalogKind, string> = {
  item: "Items",
  liquid: "Liquids",
  factory: "Factories",
  drill: "Drills",
};

export const catalog: readonly CatalogEntity[] = [
  ...items.map((entity): CatalogEntity => ({ kind: "item", ...entity })),
  ...liquids.map((entity): CatalogEntity => ({ kind: "liquid", ...entity })),
  ...factories.map((entity): CatalogEntity => ({ kind: "factory", ...entity })),
  ...drills.map((entity): CatalogEntity => ({ kind: "drill", ...entity })),
];

export function searchCatalog(query: string): readonly CatalogEntity[] {
  const q = query.trim().toLowerCase();
  if (!q) return catalog;
  return catalog.filter((entity) => entity.id.toLowerCase().includes(q) || entity.name.toLowerCase().includes(q));
}

export function catalogByKind(kind: CatalogKind): readonly CatalogEntity[] {
  return catalog.filter((entity): entity is Extract<CatalogEntity, { kind: typeof kind }> => entity.kind === kind);
}

const catalogIndex = new Map<string, CatalogEntity>(catalog.map((entity) => [entity.id, entity]));

/** Looks up any item/liquid/factory/drill by id — used to resolve resource references (build costs, inputs, outputs). */
export function findCatalogEntity(id: string): CatalogEntity | undefined {
  return catalogIndex.get(id);
}
