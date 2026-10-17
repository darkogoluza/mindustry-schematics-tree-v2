import { factory } from "../factory";
import { cost, itemFlow, liquidFlow } from "../utils/resource";
import { assertUniqueIds } from "../utils/assert-unique";
import type { Factory } from "../types";

export const factories: readonly Factory[] = assertUniqueIds("factory", [
  factory("graphite-press")("Graphite Press")(2)
    .craftTime(1.5)
    .buildCost(cost("copper")(75), cost("lead")(30))
    .inputs(itemFlow("coal")(2))
    .outputs(itemFlow("graphite")(1))
    .build(),

  factory("silicon-smelter")("Silicon Smelter")(2)
    .power(30)
    .craftTime(0.666667)
    .buildCost(cost("copper")(30), cost("lead")(25))
    .inputs(itemFlow("coal")(1), itemFlow("sand")(2))
    .outputs(itemFlow("silicon")(1))
    .build(),

  factory("kiln")("Kiln")(2)
    .power(36)
    .craftTime(0.5)
    .buildCost(cost("copper")(60), cost("lead")(30), cost("graphite")(30))
    .inputs(itemFlow("lead")(1), itemFlow("sand")(1))
    .outputs(itemFlow("metaglass")(1))
    .build(),

  factory("plastanium-compressor")("Plastanium Compressor")(2)
    .power(180)
    .craftTime(1)
    .buildCost(cost("lead")(115), cost("graphite")(60), cost("titanium")(80), cost("silicon")(80))
    .inputs(itemFlow("titanium")(2), liquidFlow("oil")(15))
    .outputs(itemFlow("plastanium")(1))
    .build(),

  factory("phase-weaver")("Phase Weaver")(2)
    .power(300)
    .craftTime(2)
    .buildCost(cost("lead")(120), cost("thorium")(75), cost("silicon")(130))
    .inputs(itemFlow("thorium")(4), itemFlow("sand")(10))
    .outputs(itemFlow("phase-fabric")(1))
    .build(),

  factory("surge-smelter")("Surge Smelter")(3)
    .power(240)
    .craftTime(1.25)
    .buildCost(cost("lead")(80), cost("thorium")(70), cost("silicon")(80))
    .inputs(itemFlow("copper")(3), itemFlow("lead")(4), itemFlow("titanium")(2), itemFlow("silicon")(3))
    .outputs(itemFlow("surge-alloy")(1))
    .build(),

  factory("pyratite-mixer")("Pyratite Mixer")(2)
    .power(12)
    .craftTime(1.333333)
    .buildCost(cost("copper")(50), cost("lead")(25))
    .inputs(itemFlow("coal")(1), itemFlow("lead")(2), itemFlow("sand")(2))
    .outputs(itemFlow("pyratite")(1))
    .build(),

  factory("blast-mixer")("Blast Mixer")(2)
    .power(24)
    .craftTime(1.333333)
    .buildCost(cost("lead")(30), cost("titanium")(20))
    .inputs(itemFlow("pyratite")(1), itemFlow("spore-pod")(1))
    .outputs(itemFlow("blast-compound")(1))
    .build(),

  factory("spore-press")("Spore Press")(2)
    .power(42)
    .craftTime(0.333333)
    .buildCost(cost("lead")(35), cost("silicon")(30))
    .inputs(itemFlow("spore-pod")(1))
    .outputs(liquidFlow("oil")(18))
    .build(),

  factory("cultivator")("Cultivator")(2)
    .power(80)
    .craftTime(1.666667)
    .buildCost(cost("copper")(25), cost("lead")(25), cost("silicon")(10))
    .inputs(liquidFlow("water")(18))
    .outputs(itemFlow("spore-pod")(1))
    .build(),

  factory("melter")("Melter")(1)
    .power(60)
    .craftTime(0.166667)
    .buildCost(cost("copper")(30), cost("lead")(35), cost("graphite")(45))
    .inputs(itemFlow("scrap")(1))
    .outputs(liquidFlow("slag")(12))
    .build(),

  factory("surge-crucible")("Surge Crucible")(3)
    .power(90)
    .craftTime(0.75)
    .heatRequired(40)
    .buildCost(cost("silicon")(100), cost("graphite")(80))
    .inputs(itemFlow("silicon")(3), liquidFlow("slag")(160))
    .outputs(itemFlow("surge-alloy")(1))
    .build(),

  factory("mechanical-pump")("Mechanical Pump")(1)
    .note("Needs water tiles")
    .buildCost(cost("copper")(15), cost("metaglass")(10))
    .outputs(liquidFlow("water")(7, { perTile: true }))
    .build(),

  factory("water-extractor")("Water Extractor")(2)
    .power(90)
    .buildCost(cost("metaglass")(30), cost("graphite")(30), cost("lead")(30), cost("copper")(30))
    .outputs(liquidFlow("water")(6.6))
    .build(),

  factory("oil-extractor")("Oil Extractor")(3)
    .power(180)
    .craftTime(1)
    .note("Needs oil-bearing ground")
    .buildCost(cost("copper")(150), cost("graphite")(175), cost("lead")(115), cost("thorium")(115), cost("silicon")(75))
    .inputs(itemFlow("sand")(1), liquidFlow("water")(9))
    .outputs(liquidFlow("oil")(15))
    .build(),
]);
