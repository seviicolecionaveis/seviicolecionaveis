import { Link } from "@tanstack/react-router";
import { useCompare } from "@/hooks/useCompare";
import { Button } from "@/components/ui/button";
import { Scale, X } from "lucide-react";

export function CompareBar() {
  const { count, clear } = useCompare();
  if (count === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full border border-border bg-card/95 shadow-lg backdrop-blur px-3 py-2 flex items-center gap-2">
      <Scale className="h-4 w-4 text-primary" />
      <span className="text-xs font-medium">
        {count} carta{count > 1 ? "s" : ""} para comparar
      </span>
      <Button asChild size="sm" className="h-8 rounded-full">
        <Link to="/comparador">Comparar</Link>
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7 rounded-full"
        onClick={clear}
        aria-label="Limpar comparação"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
