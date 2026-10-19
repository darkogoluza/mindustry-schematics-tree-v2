import { findCatalogEntity } from "@/domain/catalog";
import { EntityIcon } from "./EntityIcon";

interface ResourceEntry {
  id: string;
  label: string;
}

interface ResourceListProps {
  title: string;
  entries: readonly ResourceEntry[];
}

export function ResourceList({ title, entries }: ResourceListProps) {
  if (entries.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h4>
      <div className="flex flex-wrap gap-2">
        {entries.map((entry) => {
          const resolved = findCatalogEntity(entry.id);
          return (
            <div key={entry.id} className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-sm">
              <EntityIcon icon={resolved?.icon ?? `${import.meta.env.BASE_URL}icons/${entry.id}.png`} name={resolved?.name ?? entry.id} size={20} />
              <span>{resolved?.name ?? entry.id}</span>
              <span className="text-muted-foreground">{entry.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
