import type { Draft, Item, ItemId } from "./types";

const DEFAULTS = {
  raw: false,
  hardness: 0,
  cost: 0,
  flammability: 0,
  explosiveness: 0,
  radioactivity: 0,
  charge: 0,
} as const;

export class ItemBuilder {
  private data: Draft<Item> = { ...DEFAULTS };
  private built = false;

  private constructor(id: ItemId, name: string, color: string) {
    this.data.id = id;
    this.data.name = name;
    this.data.icon = `${import.meta.env.BASE_URL}icons/${id}.png`;
    this.data.color = color;
  }

  static create(id: ItemId) {
    return (name: string) =>
      (color: string) =>
        new ItemBuilder(id, name, color);
  }

  private assertNotBuilt(): void {
    if (this.built) throw new Error(`item "${this.data.id}" builder already built — cannot mutate or build again`);
  }

  icon(path: string): this {
    this.assertNotBuilt();
    this.data.icon = path;
    return this;
  }

  raw(value = true): this {
    this.assertNotBuilt();
    this.data.raw = value;
    return this;
  }

  hardness(value: number): this {
    this.assertNotBuilt();
    if (value < 0) throw new Error(`hardness must be >= 0, got ${value}`);
    this.data.hardness = value;
    return this;
  }

  cost(value: number): this {
    this.assertNotBuilt();
    if (value < 0) throw new Error(`cost must be >= 0, got ${value}`);
    this.data.cost = value;
    return this;
  }

  flammability(value: number): this {
    this.assertNotBuilt();
    this.data.flammability = value;
    return this;
  }

  explosiveness(value: number): this {
    this.assertNotBuilt();
    this.data.explosiveness = value;
    return this;
  }

  radioactivity(value: number): this {
    this.assertNotBuilt();
    this.data.radioactivity = value;
    return this;
  }

  charge(value: number): this {
    this.assertNotBuilt();
    this.data.charge = value;
    return this;
  }

  build(): Item {
    this.assertNotBuilt();
    if (!this.data.raw && this.data.hardness) {
      throw new Error(`item "${this.data.id}" is not raw but has hardness ${this.data.hardness} — hardness only applies to mined ores`);
    }
    this.built = true;
    return Object.freeze({ ...DEFAULTS, ...this.data } as Item);
  }
}

/** Curried factory: item("copper")("Copper")("#d99d73") — icon defaults to "icons/copper.png" */
export const item = ItemBuilder.create;
