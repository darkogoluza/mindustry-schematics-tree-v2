import { overdrive } from "../overdrive";
import { cost } from "../utils/resource";
import { assertUniqueIds } from "../utils/assert-unique";
import type { Overdrive } from "../types";

export const overdrives: readonly Overdrive[] = assertUniqueIds("overdrive", [
  overdrive("overdrive-projector")("Overdrive Projector")(2)
    .health(175)
    .power(210)
    .buildTime(4.066)
    .buildCost(cost("lead")(100), cost("titanium")(75), cost("silicon")(75), cost("plastanium")(30))
    .itemCapacity(10)
    .speedIncrease(0.5)
    .range(10)
    .booster("phase-fabric", 0.15, 0.75, 2.5)
    .build(),

  overdrive("overdrive-dome")("Overdrive Dome")(3)
    .health(485)
    .power(600)
    .buildTime(10.366)
    .buildCost(cost("lead")(200), cost("titanium")(130), cost("silicon")(130), cost("plastanium")(80), cost("surge-alloy")(120))
    .itemCapacity(10)
    .speedIncrease(1.5)
    .range(25)
    .requiredInputs({ itemId: "phase-fabric", rate: 0.2 }, { itemId: "silicon", rate: 0.2 })
    .build(),
]);
