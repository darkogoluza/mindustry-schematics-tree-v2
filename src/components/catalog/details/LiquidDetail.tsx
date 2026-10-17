import type { Liquid } from "@/domain/types";
import { StatRow } from "../StatRow";

export function LiquidDetail({ entity }: { entity: Liquid }) {
  return (
    <div className="space-y-1">
      <StatRow label="Color" value={entity.color} />
    </div>
  );
}
