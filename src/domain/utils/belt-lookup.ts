import { belts } from "../data/belts.data";
import type { Belt } from "../types";

export function requireBelt(id: string): Belt {
  const found = belts.find((b) => b.id === id);
  if (!found) throw new Error(`expected belt "${id}" in belt data`);
  return found;
}
