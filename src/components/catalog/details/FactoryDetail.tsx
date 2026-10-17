import type { Factory, FlowEntry } from "@/domain/types";
import { StatRow } from "../StatRow";
import { ResourceList } from "../ResourceList";

function flowLabel(entry: FlowEntry): string {
  return entry.type === "item" ? `x${entry.amount}` : `${entry.rate}/s${entry.perTile ? " per tile" : ""}`;
}

/**
 * Renders a factory's detail body. Add new sections here as more factory data
 * becomes available (e.g. efficiency curves, upgrade tiers) — each section is
 * independent and only renders when its data is present.
 */
export function FactoryDetail({ entity }: { entity: Factory }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <StatRow label="Size" value={`${entity.size}x${entity.size}`} />
        {entity.power > 0 && <StatRow label="Power" value={`${entity.power}`} />}
        {entity.craftTime > 0 && <StatRow label="Craft time" value={`${entity.craftTime}s`} />}
        {entity.heatRequired > 0 && <StatRow label="Heat required" value={entity.heatRequired} />}
        {entity.note && <StatRow label="Note" value={entity.note} />}
      </div>

      <ResourceList title="Build cost" entries={entity.buildCost.map((e) => ({ id: e.item, label: `x${e.amount}` }))} />
      <ResourceList title="Inputs" entries={entity.inputs.map((e) => ({ id: e.id, label: flowLabel(e) }))} />
      <ResourceList title="Outputs" entries={entity.outputs.map((e) => ({ id: e.id, label: flowLabel(e) }))} />
    </div>
  );
}
