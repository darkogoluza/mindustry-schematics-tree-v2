import type { BuildCostEntry, Draft, ItemId, Overdrive, OverdriveInput } from "./types";

const DEFAULTS = {
  buildCost: [],
  requiredInputs: [],
} as const;

export class OverdriveBuilder {
  private data: Draft<Overdrive> = { ...DEFAULTS };
  private built = false;

  private constructor(id: string, name: string, size: number) {
    if (size < 1) throw new Error(`size must be >= 1, got ${size}`);
    this.data.id = id;
    this.data.name = name;
    this.data.icon = `/icons/${id}.png`;
    this.data.size = size;
  }

  static create(id: string) {
    return (name: string) =>
      (size: number) =>
        new OverdriveBuilder(id, name, size);
  }

  private assertNotBuilt(): void {
    if (this.built) throw new Error(`overdrive "${this.data.id}" builder already built — cannot mutate or build again`);
  }

  icon(path: string): this {
    this.assertNotBuilt();
    this.data.icon = path;
    return this;
  }

  health(value: number): this {
    this.assertNotBuilt();
    if (value <= 0) throw new Error(`health must be > 0, got ${value}`);
    this.data.health = value;
    return this;
  }

  power(value: number): this {
    this.assertNotBuilt();
    if (value < 0) throw new Error(`power must be >= 0, got ${value}`);
    this.data.power = value;
    return this;
  }

  buildTime(value: number): this {
    this.assertNotBuilt();
    if (value < 0) throw new Error(`buildTime must be >= 0, got ${value}`);
    this.data.buildTime = value;
    return this;
  }

  buildCost(...entries: BuildCostEntry[]): this {
    this.assertNotBuilt();
    this.data.buildCost = entries;
    return this;
  }

  itemCapacity(value: number): this {
    this.assertNotBuilt();
    if (value <= 0) throw new Error(`itemCapacity must be > 0, got ${value}`);
    this.data.itemCapacity = value;
    return this;
  }

  speedIncrease(value: number): this {
    this.assertNotBuilt();
    if (value <= 0) throw new Error(`speedIncrease must be > 0, got ${value}`);
    this.data.speedIncrease = value;
    return this;
  }

  range(value: number): this {
    this.assertNotBuilt();
    if (value <= 0) throw new Error(`range must be > 0, got ${value}`);
    this.data.range = value;
    return this;
  }

  requiredInputs(...entries: OverdriveInput[]): this {
    this.assertNotBuilt();
    this.data.requiredInputs = entries;
    return this;
  }

  booster(itemId: ItemId, rate: number, bonusSpeedIncrease: number, bonusRange: number): this {
    this.assertNotBuilt();
    if (rate <= 0) throw new Error(`booster rate must be > 0, got ${rate}`);
    if (bonusSpeedIncrease <= 0) throw new Error(`booster bonusSpeedIncrease must be > 0, got ${bonusSpeedIncrease}`);
    this.data.booster = { itemId, rate, bonusSpeedIncrease, bonusRange };
    return this;
  }

  build(): Overdrive {
    this.assertNotBuilt();
    if (this.data.health === undefined) throw new Error(`overdrive "${this.data.id}" built without health`);
    if (this.data.power === undefined) throw new Error(`overdrive "${this.data.id}" built without power`);
    if (this.data.buildTime === undefined) throw new Error(`overdrive "${this.data.id}" built without buildTime`);
    if (this.data.itemCapacity === undefined) throw new Error(`overdrive "${this.data.id}" built without itemCapacity`);
    if (this.data.speedIncrease === undefined) throw new Error(`overdrive "${this.data.id}" built without speedIncrease`);
    if (this.data.range === undefined) throw new Error(`overdrive "${this.data.id}" built without range`);
    this.built = true;
    return Object.freeze({ ...DEFAULTS, ...this.data } as Overdrive);
  }
}

/** Curried factory: overdrive("overdrive-projector")("Overdrive Projector")(2) — icon defaults to "/icons/overdrive-projector.png" */
export const overdrive = OverdriveBuilder.create;
