import type { BuildCostEntry, Draft, Factory, FlowEntry } from "./types";

const DEFAULTS = {
  power: 0,
  craftTime: 0,
  heatRequired: 0,
  buildCost: [],
  inputs: [],
  outputs: [],
} as const;

export class FactoryBuilder {
  private data: Draft<Factory> = { ...DEFAULTS };
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
        new FactoryBuilder(id, name, size);
  }

  private assertNotBuilt(): void {
    if (this.built) throw new Error(`factory "${this.data.id}" builder already built — cannot mutate or build again`);
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

  craftTime(value: number): this {
    this.assertNotBuilt();
    if (value < 0) throw new Error(`craftTime must be >= 0, got ${value}`);
    this.data.craftTime = value;
    return this;
  }

  heatRequired(value: number): this {
    this.assertNotBuilt();
    if (value < 0) throw new Error(`heatRequired must be >= 0, got ${value}`);
    this.data.heatRequired = value;
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

  inputs(...entries: FlowEntry[]): this {
    this.assertNotBuilt();
    this.data.inputs = entries;
    return this;
  }

  outputs(...entries: FlowEntry[]): this {
    this.assertNotBuilt();
    if (entries.length === 0) throw new Error(`factory "${this.data.id}" needs at least one output`);
    this.data.outputs = entries;
    return this;
  }

  build(): Factory {
    this.assertNotBuilt();
    if (!this.data.outputs || this.data.outputs.length === 0) {
      throw new Error(`factory "${this.data.id}" built without outputs`);
    }
    this.built = true;
    return Object.freeze({ ...DEFAULTS, ...this.data } as Factory);
  }
}

/** Curried factory: factory("kiln")("Kiln")(2) — icon defaults to "icons/kiln.png" */
export const factory = FactoryBuilder.create;
