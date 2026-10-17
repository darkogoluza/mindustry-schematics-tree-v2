import type { Belt, BuildCostEntry, Draft } from "./types";

const DEFAULTS = {
  buildCost: [],
} as const;

export class BeltBuilder {
  private data: Draft<Belt> = { ...DEFAULTS };
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
        new BeltBuilder(id, name, size);
  }

  private assertNotBuilt(): void {
    if (this.built) throw new Error(`belt "${this.data.id}" builder already built — cannot mutate or build again`);
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

  moveSpeed(value: number): this {
    this.assertNotBuilt();
    if (value <= 0) throw new Error(`moveSpeed must be > 0, got ${value}`);
    this.data.moveSpeed = value;
    return this;
  }

  build(): Belt {
    this.assertNotBuilt();
    if (this.data.health === undefined) throw new Error(`belt "${this.data.id}" built without health`);
    if (this.data.buildTime === undefined) throw new Error(`belt "${this.data.id}" built without buildTime`);
    if (this.data.itemCapacity === undefined) throw new Error(`belt "${this.data.id}" built without itemCapacity`);
    if (this.data.moveSpeed === undefined) throw new Error(`belt "${this.data.id}" built without moveSpeed`);
    this.built = true;
    return Object.freeze({ ...DEFAULTS, ...this.data } as Belt);
  }
}

/** Curried factory: belt("conveyor")("Conveyor")(1) — icon defaults to "/icons/conveyor.png" */
export const belt = BeltBuilder.create;
