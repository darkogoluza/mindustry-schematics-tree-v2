import { belt } from "../belt";
import { cost } from "../utils/resource";
import { assertUniqueIds } from "../utils/assert-unique";
import type { Belt } from "../types";

export const belts: readonly Belt[] = assertUniqueIds("belt", [
  belt("conveyor")("Conveyor")(1)
    .health(45)
    .buildTime(0.008)
    .buildCost(cost("copper")(1))
    .itemCapacity(3)
    .moveSpeed(5)
    .build(),

  belt("titanium-conveyor")("Titanium Conveyor")(1)
    .health(65)
    .buildTime(0.036)
    .buildCost(cost("copper")(1), cost("lead")(1), cost("titanium")(1))
    .itemCapacity(3)
    .moveSpeed(10)
    .build(),
]);
