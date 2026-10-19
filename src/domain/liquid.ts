import type { Draft, Liquid, LiquidId } from "./types";

export class LiquidBuilder {
  private data: Draft<Liquid> = {};
  private built = false;

  private constructor(id: LiquidId, name: string, color: string) {
    this.data.id = id;
    this.data.name = name;
    this.data.icon = `${import.meta.env.BASE_URL}icons/${id}.png`;
    this.data.color = color;
  }

  static create(id: LiquidId) {
    return (name: string) =>
      (color: string) =>
        new LiquidBuilder(id, name, color);
  }

  private assertNotBuilt(): void {
    if (this.built) throw new Error(`liquid "${this.data.id}" builder already built — cannot mutate or build again`);
  }

  icon(path: string): this {
    this.assertNotBuilt();
    this.data.icon = path;
    return this;
  }

  build(): Liquid {
    this.assertNotBuilt();
    this.built = true;
    return Object.freeze({ ...this.data } as Liquid);
  }
}

/** Curried factory: liquid("water")("Water")("#596ab8") — icon defaults to "icons/water.png" */
export const liquid = LiquidBuilder.create;
