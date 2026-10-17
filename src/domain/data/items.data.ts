import { item } from "../item";
import { assertUniqueIds } from "../utils/assert-unique";
import type { Item } from "../types";

export const items: readonly Item[] = assertUniqueIds("item", [
  item("copper")("Copper")("#d99d73").raw().hardness(1).cost(0.5).build(),
  item("lead")("Lead")("#8c7fa9").raw().hardness(1).cost(0.7).build(),
  item("metaglass")("Metaglass")("#ebeef5").cost(1.5).build(),
  item("graphite")("Graphite")("#b2c6d2").hardness(0).cost(1).build(),
  item("sand")("Sand")("#f7cba4").raw().hardness(0).build(),
  item("coal")("Coal")("#272727").raw().hardness(2).flammability(1).explosiveness(0.2).build(),
  item("titanium")("Titanium")("#8da1e3").raw().hardness(3).cost(1).build(),
  item("thorium")("Thorium")("#f9a3c7").raw().hardness(4).cost(1.1).explosiveness(0.2).radioactivity(1).build(),
  item("scrap")("Scrap")("#777777").raw().hardness(0).cost(0.5).build(),
  item("silicon")("Silicon")("#53565c").cost(0.8).build(),
  item("plastanium")("Plastanium")("#cbd97f").cost(1.3).flammability(0.1).explosiveness(0.2).build(),
  item("phase-fabric")("Phase Fabric")("#f4ba6e").cost(1.3).radioactivity(0.6).build(),
  item("surge-alloy")("Surge Alloy")("#f3e979").cost(1.2).charge(0.75).build(),
  item("spore-pod")("Spore Pod")("#7457ce").flammability(1.15).build(),
  item("blast-compound")("Blast Compound")("#ff795e").flammability(0.4).explosiveness(1.2).build(),
  item("pyratite")("Pyratite")("#ffaa5f").flammability(1.4).explosiveness(0.4).build(),
]);
