/** Throws if any entity in the list shares an id with another. Returns the list unchanged. */
export function assertUniqueIds<T extends { readonly id: string }>(label: string, entities: readonly T[]): readonly T[] {
  const seen = new Set<string>();
  for (const { id } of entities) {
    if (seen.has(id)) throw new Error(`duplicate ${label} id: "${id}"`);
    seen.add(id);
  }
  return entities;
}
