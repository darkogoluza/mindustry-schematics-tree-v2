import type { BuildCostEntry, Boost, Draft, Drill, ItemId } from "./types";

const DEFAULTS = {
  power: 0,
  buildCost: [],
  mines: {},
} as const;

export class DrillBuilder {
  private data: Draft<Drill> = { ...DEFAULTS };
  private built = false;

  private constructor(id: string, name: string, size: number) {
    if (size < 1) throw new Error(`size must be >= 1, got ${size}`);
    this.data.id = id;
    this.data.name = name;
    this.data.icon = `icons/${id}.png`;
    this.data.size = size;
  }

  static create(id: string) {
    return (name: string) =>
      (size: number) =>
        new DrillBuilder(id, name, size);
  }

  private assertNotBuilt(): void {
    if (this.built) throw new Error(`drill "${this.data.id}" builder already built — cannot mutate or build again`);
  }

  icon(path: string): this {
    this.assertNotBuilt();
    this.data.icon = path;
    return this;
  }

  power(value: number): this {
    this.assertNotBuilt();
    if (value < 0) throw new Error(`power must be >= 0, got ${value}`);
    this.data.power = value;
    return this;
  }

  note(value: string): this {
    this.assertNotBuilt();
    this.data.note = value;
    return this;
  }

  buildCost(...entries: BuildCostEntry[]): this {
    this.assertNotBuilt();
    this.data.buildCost = entries;
    return this;
  }

  boost(value: Boost): this {
    this.assertNotBuilt();
    if (value.rate <= 0) throw new Error(`drill "${this.data.id}" boost rate must be > 0, got ${value.rate}`);
    if (value.multiplier <= 0) throw new Error(`drill "${this.data.id}" boost multiplier must be > 0, got ${value.multiplier}`);
    this.data.boost = value;
    return this;
  }

  mines(table: Partial<Record<ItemId, number>>): this {
    this.assertNotBuilt();
    const entries = Object.entries(table);
    if (entries.length === 0) throw new Error(`drill "${this.data.id}" needs at least one mineable item`);
    for (const [id, rate] of entries) {
      if (rate !== undefined && rate <= 0) throw new Error(`drill "${this.data.id}" mines rate for "${id}" must be > 0, got ${rate}`);
    }
    this.data.mines = table;
    return this;
  }

  build(): Drill {
    this.assertNotBuilt();
    if (!this.data.mines || Object.keys(this.data.mines).length === 0) {
      throw new Error(`drill "${this.data.id}" built without mines`);
    }
    this.built = true;
    return Object.freeze({ ...DEFAULTS, ...this.data } as Drill);
  }
}

/** Curried factory: drill("laser-drill")("Laser Drill")(3) — icon defaults to "icons/laser-drill.png" */
export const drill = DrillBuilder.create;
