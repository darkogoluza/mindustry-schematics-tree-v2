import { CatalogPage } from "@/components/catalog/CatalogPage";
import { TooltipProvider } from "@/components/ui/tooltip";

function App() {
  return (
    <TooltipProvider>
      <CatalogPage />
    </TooltipProvider>
  );
}

export default App
