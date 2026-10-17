import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
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

export function EntityDetail({ entity, onOpenChange }: EntityDetailProps) {
  return (
    <Sheet open={entity !== undefined} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-0">
        {entity && (
          <>
            <SheetHeader>
              <div className="flex items-center gap-3">
                <EntityIcon icon={entity.icon} name={entity.name} size={44} />
                <div>
                  <SheetTitle>{entity.name}</SheetTitle>
                  <SheetDescription>
                    <Badge variant="secondary">{CATALOG_KIND_LABEL[entity.kind]}</Badge>
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>
            <ScrollArea className="flex-1 px-4 pb-4">
              <DetailBody entity={entity} />
            </ScrollArea>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
