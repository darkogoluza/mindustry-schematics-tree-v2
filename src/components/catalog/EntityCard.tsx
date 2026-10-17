import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CatalogEntity } from "@/domain/catalog";
import { CATALOG_KIND_LABEL } from "@/domain/catalog";
import { EntityIcon } from "./EntityIcon";

interface EntityCardProps {
  entity: CatalogEntity;
  onClick: () => void;
}

export function EntityCard({ entity, onClick }: EntityCardProps) {
  return (
    <Card
      onClick={onClick}
      className="flex cursor-pointer flex-col items-center gap-2 p-3 text-center transition-colors hover:bg-muted"
    >
      <EntityIcon icon={entity.icon} name={entity.name} size={48} />
      <span className="text-sm font-medium">{entity.name}</span>
      <Badge variant="outline" className="text-[10px]">
        {CATALOG_KIND_LABEL[entity.kind]}
      </Badge>
    </Card>
  );
}
