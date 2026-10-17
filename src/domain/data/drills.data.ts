import { drill } from "../drill";
import { cost, boost } from "../utils/resource";
import { assertUniqueIds } from "../utils/assert-unique";
import type { Drill } from "../types";

export const drills: readonly Drill[] = assertUniqueIds("drill", [
  drill("mechanical-drill")("Mechanical Drill")(2)
    .buildCost(cost("copper")(12))
    .boost(boost("water")("liquid")(3)(2.56))
    .mines({ sand: 0.4, copper: 0.36, lead: 0.36, scrap: 0.4, coal: 0.34 })
    .build(),

  drill("pneumatic-drill")("Pneumatic Drill")(2)
    .buildCost(cost("copper")(18), cost("graphite")(10))
    .boost(boost("water")("liquid")(3.5)(2.56))
    .mines({ sand: 0.6, copper: 0.53, lead: 0.53, scrap: 0.6, coal: 0.48, titanium: 0.43 })
    .build(),

  drill("laser-drill")("Laser Drill")(3)
    .power(66)
    .buildCost(cost("copper")(35), cost("graphite")(30), cost("titanium")(20), cost("silicon")(30))
    .boost(boost("water")("liquid")(4.8)(2.56))
    .mines({ sand: 1.92, copper: 1.63, lead: 1.63, scrap: 1.92, coal: 1.42, titanium: 1.25, thorium: 1.12 })
    .build(),

  drill("blast-drill")("Airblast Drill")(4)
    .power(180)
    .buildCost(cost("copper")(65), cost("titanium")(50), cost("thorium")(75), cost("silicon")(60))
    .boost(boost("water")("liquid")(6)(3.24))
    .mines({ sand: 3.42, copper: 2.9, lead: 2.9, scrap: 3.42, coal: 2.52, titanium: 2.23, thorium: 2 })
    .build(),
]);
