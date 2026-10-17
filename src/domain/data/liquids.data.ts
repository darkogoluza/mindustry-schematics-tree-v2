import { liquid } from "../liquid";
import { assertUniqueIds } from "../utils/assert-unique";
import type { Liquid } from "../types";

export const liquids: readonly Liquid[] = assertUniqueIds("liquid", [
  liquid("water")("Water")("#596ab8").build(),
  liquid("slag")("Slag")("#ffa166").build(),
  liquid("oil")("Oil")("#313131").build(),
]);
