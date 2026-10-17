import { useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { catalogByKind, searchCatalog, CATALOG_KIND_LABEL_PLURAL, type CatalogEntity, type CatalogKind } from "@/domain/catalog";
import { SearchBar } from "./SearchBar";
import { EntityCard } from "./EntityCard";
import { EntityDetail } from "./EntityDetail";

const KINDS: readonly CatalogKind[] = ["item", "liquid", "factory", "drill"];

function EntityGrid({ entities, onSelect }: { entities: readonly CatalogEntity[]; onSelect: (entity: CatalogEntity) => void }) {
  if (entities.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">No results.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {entities.map((entity) => (
        <EntityCard key={`${entity.kind}:${entity.id}`} entity={entity} onClick={() => onSelect(entity)} />
      ))}
    </div>
  );
}

export function CatalogPage() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<CatalogEntity | undefined>(undefined);

  const searchResults = useMemo(() => (query.trim() ? searchCatalog(query) : undefined), [query]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Schematics Tree</h1>
        <SearchBar value={query} onChange={setQuery} />
      </header>

      {searchResults ? (
        <EntityGrid entities={searchResults} onSelect={setSelected} />
      ) : (
        <Tabs defaultValue="item">
          <TabsList>
            {KINDS.map((kind) => (
              <TabsTrigger key={kind} value={kind}>
                {CATALOG_KIND_LABEL_PLURAL[kind]}
              </TabsTrigger>
            ))}
          </TabsList>
          {KINDS.map((kind) => (
            <TabsContent key={kind} value={kind} className="mt-4">
              <EntityGrid entities={catalogByKind(kind)} onSelect={setSelected} />
            </TabsContent>
          ))}
        </Tabs>
      )}

      <EntityDetail entity={selected} onOpenChange={(open) => !open && setSelected(undefined)} />
    </div>
  );
}
