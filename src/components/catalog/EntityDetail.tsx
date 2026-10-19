import { XIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { CatalogEntity } from "@/domain/catalog";
import { CATALOG_KIND_LABEL } from "@/domain/catalog";
import { EntityIcon } from "./EntityIcon";
import { ItemDetail } from "./details/ItemDetail";
import { LiquidDetail } from "./details/LiquidDetail";
import { FactoryDetail } from "./details/FactoryDetail";
import { DrillDetail } from "./details/DrillDetail";

interface EntityDetailProps {
  entity: CatalogEntity | undefined;
  onOpenChange: (open: boolean) => void;
}

/** Dispatches to the per-kind detail body. Add a new kind here when a new entity type is introduced. */
function DetailBody({ entity }: { entity: CatalogEntity }) {
  switch (entity.kind) {
    case "item":
      return <ItemDetail entity={entity} />;
    case "liquid":
      return <LiquidDetail entity={entity} />;
    case "factory":
      return <FactoryDetail entity={entity} />;
    case "drill":
      return <DrillDetail entity={entity} />;
  }
}

/**
 * A docked side panel, not a modal — no backdrop/dimming, so the catalog behind it stays fully
 * visible and interactive (clicking another card just swaps the panel's content).
 */
export function EntityDetail({ entity, onOpenChange }: EntityDetailProps) {
  if (!entity) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-border bg-popover shadow-lg sm:max-w-5xl">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border p-4">
        <div className="flex items-center gap-3">
          <EntityIcon icon={entity.icon} name={entity.name} size={44} />
          <div>
            <h2 className="text-lg font-semibold">{entity.name}</h2>
            <Badge variant="secondary">{CATALOG_KIND_LABEL[entity.kind]}</Badge>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
          <XIcon />
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1 px-4 pb-4">
        <DetailBody entity={entity} />
      </ScrollArea>
    </div>
  );
}
