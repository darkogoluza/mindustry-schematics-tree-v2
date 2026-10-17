import type { Item } from "@/domain/types";
import { StatRow } from "../StatRow";

export function ItemDetail({ entity }: { entity: Item }) {
  return (
    <div className="space-y-1">
      <StatRow label="Type" value={entity.raw ? "Raw ore" : "Synthesized"} />
      {entity.raw && <StatRow label="Hardness" value={entity.hardness} />}
      {entity.cost > 0 && <StatRow label="Cost" value={entity.cost} />}
      {entity.flammability > 0 && <StatRow label="Flammability" value={entity.flammability} />}
      {entity.explosiveness > 0 && <StatRow label="Explosiveness" value={entity.explosiveness} />}
      {entity.radioactivity > 0 && <StatRow label="Radioactivity" value={entity.radioactivity} />}
      {entity.charge > 0 && <StatRow label="Charge" value={entity.charge} />}
    </div>
  );
}
