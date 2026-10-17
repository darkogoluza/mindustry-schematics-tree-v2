import type { Drill } from "@/domain/types";
import { StatRow } from "../StatRow";
import { ResourceList } from "../ResourceList";

export function DrillDetail({ entity }: { entity: Drill }) {
  const mines = Object.entries(entity.mines).map(([id, rate]) => ({ id, label: `${rate}/s` }));

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <StatRow label="Size" value={`${entity.size}x${entity.size}`} />
        {entity.power > 0 && <StatRow label="Power" value={entity.power} />}
        {entity.note && <StatRow label="Note" value={entity.note} />}
        {entity.boost && <StatRow label="Boost" value={`${entity.boost.id} x${entity.boost.multiplier} (needs ${entity.boost.rate}/s)`} />}
      </div>

      <ResourceList title="Build cost" entries={entity.buildCost.map((e) => ({ id: e.item, label: `x${e.amount}` }))} />
      <ResourceList title="Mines" entries={mines} />
    </div>
  );
}
