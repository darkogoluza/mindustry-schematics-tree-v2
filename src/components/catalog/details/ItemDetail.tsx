import { useMemo, useState } from "react";
import type { Item } from "@/domain/types";
import { getCraftPermutationsPage } from "@/domain/planner/craft-permutations";
import { CraftGraphFlow } from "@/components/planner/CraftGraphFlow";
import { PermutationCostSummary } from "@/components/planner/PermutationCostSummary";
import { CraftFiltersPanel, EMPTY_FILTER_STATE, toCraftFilters, type CraftFilterState } from "@/components/planner/CraftFiltersPanel";
import { Button } from "@/components/ui/button";
import { StatRow } from "../StatRow";

const PAGE_SIZE = 12;

export function ItemDetail({ entity }: { entity: Item }) {
  const [page, setPage] = useState(0);
  const [filterState, setFilterState] = useState<CraftFilterState>(EMPTY_FILTER_STATE);

  const filters = useMemo(() => toCraftFilters(filterState), [filterState]);
  const { items: permutations, totalCount, hasMore } = useMemo(
    () => getCraftPermutationsPage(entity.id, page, PAGE_SIZE, filters),
    [entity.id, page, filters],
  );

  const handleFilterChange = (next: CraftFilterState) => {
    setFilterState(next);
    setPage(0);
  };

  const totalPages = totalCount !== undefined ? Math.max(1, Math.ceil(totalCount / PAGE_SIZE)) : undefined;
  const countLabel =
    totalCount !== undefined
      ? `${totalCount.toLocaleString()} permutation${totalCount === 1 ? "" : "s"} · page ${page + 1} of ${totalPages!.toLocaleString()}`
      : `page ${page + 1} (exact count unavailable with range filters)`;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <StatRow label="Type" value={entity.raw ? "Raw ore" : "Synthesized"} />
        {entity.raw && <StatRow label="Hardness" value={entity.hardness} />}
        {entity.cost > 0 && <StatRow label="Cost" value={entity.cost} />}
        {entity.flammability > 0 && <StatRow label="Flammability" value={entity.flammability} />}
        {entity.explosiveness > 0 && <StatRow label="Explosiveness" value={entity.explosiveness} />}
        {entity.radioactivity > 0 && <StatRow label="Radioactivity" value={entity.radioactivity} />}
        {entity.charge > 0 && <StatRow label="Charge" value={entity.charge} />}
      </div>

      <div>
        <h4 className="mb-3 text-xs font-semibold text-muted-foreground uppercase">Production plan</h4>
        <CraftFiltersPanel value={filterState} onChange={handleFilterChange} />

        {permutations.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No permutations match these filters.</p>
        ) : (
          <>
            <div className="my-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{countLabel}</span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  Prev
                </Button>
                <Button size="sm" variant="outline" disabled={!hasMore} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {permutations.map((perm) => (
                <div
                  key={perm.id}
                  tabIndex={0}
                  className="rounded-lg border border-border p-3 shadow-sm outline-none transition-shadow hover:shadow-md hover:ring-1 hover:ring-primary focus-visible:shadow-md focus-visible:ring-1 focus-visible:ring-primary"
                >
                  <h5 className="mb-1 text-xs font-medium text-muted-foreground">{perm.label}</h5>
                  <div className="mb-2">
                    <PermutationCostSummary
                      cost={perm.cost}
                      efficiency={perm.metrics.efficiency}
                      totalArea={perm.metrics.totalArea}
                      drillArea={perm.metrics.drillArea}
                    />
                  </div>
                  <CraftGraphFlow roots={perm.overdriveGraph ? [perm.graph, perm.overdriveGraph] : [perm.graph]} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
