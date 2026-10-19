import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { overdriveVariants } from "@/domain/planner/overdrive-variants";
import { drills } from "@/domain/data/drills.data";
import type { CraftFilters } from "@/domain/planner/craft-permutations";

export interface CraftFilterState {
  readonly overdriveKeys: ReadonlySet<string>;
  readonly beltLabels: ReadonlySet<string>;
  readonly drillIds: ReadonlySet<string>;
  readonly minPower?: number;
  readonly maxPower?: number;
  readonly minWater?: number;
  readonly maxWater?: number;
  /** 0..100, UI-friendly percent — converted to 0..1 by toCraftFilters. */
  readonly minEfficiencyPct?: number;
  readonly maxEfficiencyPct?: number;
}

export const EMPTY_FILTER_STATE: CraftFilterState = {
  overdriveKeys: new Set(),
  beltLabels: new Set(),
  drillIds: new Set(),
};

export function toCraftFilters(state: CraftFilterState): CraftFilters {
  return {
    overdriveKeys: state.overdriveKeys,
    beltLabels: state.beltLabels,
    drillIds: state.drillIds,
    minPower: state.minPower,
    maxPower: state.maxPower,
    minWater: state.minWater,
    maxWater: state.maxWater,
    minEfficiency: state.minEfficiencyPct !== undefined ? state.minEfficiencyPct / 100 : undefined,
    maxEfficiency: state.maxEfficiencyPct !== undefined ? state.maxEfficiencyPct / 100 : undefined,
  };
}

function toggleInSet<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function ToggleChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button type="button" size="sm" variant={active ? "default" : "outline"} onClick={onClick} className="h-7 px-2.5 text-[11px]">
      {children}
    </Button>
  );
}

function RangeField({
  label,
  min,
  max,
  onMinChange,
  onMaxChange,
}: {
  label: string;
  min: number | undefined;
  max: number | undefined;
  onMinChange: (v: number | undefined) => void;
  onMaxChange: (v: number | undefined) => void;
}) {
  const parse = (v: string) => (v === "" ? undefined : Number(v));
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-14 shrink-0 text-[11px] text-muted-foreground">{label}</span>
      <Input type="number" placeholder="min" value={min ?? ""} onChange={(e) => onMinChange(parse(e.target.value))} className="h-7 w-20 text-[11px]" />
      <span className="text-muted-foreground">–</span>
      <Input type="number" placeholder="max" value={max ?? ""} onChange={(e) => onMaxChange(parse(e.target.value))} className="h-7 w-20 text-[11px]" />
    </div>
  );
}

const BELT_LABELS = ["regular conveyor", "titanium conveyor"] as const;

export function CraftFiltersPanel({ value, onChange }: { value: CraftFilterState; onChange: (next: CraftFilterState) => void }) {
  const variants = overdriveVariants();
  const anyActive =
    value.overdriveKeys.size > 0 ||
    value.beltLabels.size > 0 ||
    value.drillIds.size > 0 ||
    value.minPower !== undefined ||
    value.maxPower !== undefined ||
    value.minWater !== undefined ||
    value.maxWater !== undefined ||
    value.minEfficiencyPct !== undefined ||
    value.maxEfficiencyPct !== undefined;

  return (
    <div className="space-y-2.5 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase">Filters</span>
        {anyActive && (
          <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => onChange(EMPTY_FILTER_STATE)}>
            Clear all
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="w-14 shrink-0 text-[11px] text-muted-foreground">Overdrive</span>
        {variants.map((v) => (
          <ToggleChip
            key={v.key}
            active={value.overdriveKeys.has(v.key)}
            onClick={() => onChange({ ...value, overdriveKeys: toggleInSet(value.overdriveKeys, v.key) })}
          >
            {v.label || "None"}
          </ToggleChip>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="w-14 shrink-0 text-[11px] text-muted-foreground">Belt</span>
        {BELT_LABELS.map((label) => (
          <ToggleChip key={label} active={value.beltLabels.has(label)} onClick={() => onChange({ ...value, beltLabels: toggleInSet(value.beltLabels, label) })}>
            {label === "regular conveyor" ? "Regular" : "Titanium"}
          </ToggleChip>
        ))}
      </div>

      <div className={cn("flex flex-wrap items-center gap-1.5")}>
        <span className="w-14 shrink-0 text-[11px] text-muted-foreground">Drill</span>
        {drills.map((d) => (
          <ToggleChip key={d.id} active={value.drillIds.has(d.id)} onClick={() => onChange({ ...value, drillIds: toggleInSet(value.drillIds, d.id) })}>
            {d.name}
          </ToggleChip>
        ))}
      </div>

      <RangeField
        label="Power"
        min={value.minPower}
        max={value.maxPower}
        onMinChange={(v) => onChange({ ...value, minPower: v })}
        onMaxChange={(v) => onChange({ ...value, maxPower: v })}
      />
      <RangeField
        label="Water"
        min={value.minWater}
        max={value.maxWater}
        onMinChange={(v) => onChange({ ...value, minWater: v })}
        onMaxChange={(v) => onChange({ ...value, maxWater: v })}
      />
      <RangeField
        label="Eff. %"
        min={value.minEfficiencyPct}
        max={value.maxEfficiencyPct}
        onMinChange={(v) => onChange({ ...value, minEfficiencyPct: v })}
        onMaxChange={(v) => onChange({ ...value, maxEfficiencyPct: v })}
      />
    </div>
  );
}
