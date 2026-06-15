import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Bell, Trash2, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { listMyStockAlerts, deleteMyStockAlert } from "@/lib/stock-alerts-list.functions";

interface Alert {
  id: string;
  card_key: string;
  card_name: string;
  card_collection: string;
  card_number: string;
  created_at: string;
  notified_at: string | null;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function StockAlertsManager() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const list = useServerFn(listMyStockAlerts);
  const del = useServerFn(deleteMyStockAlert);

  useEffect(() => {
    list()
      .then((r) => setAlerts(r.alerts))
      .finally(() => setLoading(false));
  }, [list]);

  const handleDelete = async (id: string) => {
    const prev = alerts;
    setAlerts((a) => a.filter((x) => x.id !== id));
    const res = await del({ data: { id } });
    if (!res.success) {
      setAlerts(prev);
      toast.error("Erro ao remover alerta");
    } else {
      toast.success("Alerta removido");
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  if (alerts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center">
        <Bell className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">Você não tem alertas de estoque ativos.</p>
        <p className="text-xs text-muted-foreground mt-1">
          No catálogo, clique em "Avisar quando voltar" em cartas esgotadas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-3">
        Você receberá um e-mail assim que a carta voltar ao estoque.
      </p>
      {alerts.map((a) => {
        const slug = slugify(`${a.card_name}-${a.card_collection}-${a.card_number}`);
        return (
          <div
            key={a.id}
            className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
          >
            {a.notified_at ? (
              <BellRing className="h-4 w-4 text-brand-gold flex-shrink-0" />
            ) : (
              <Bell className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <Link
                to="/carta/$slug"
                params={{ slug }}
                className="text-sm font-medium hover:underline block truncate"
              >
                {a.card_name}
              </Link>
              <p className="text-xs text-muted-foreground truncate">
                {a.card_collection} • {a.card_number}
                {a.notified_at && " • Notificado"}
              </p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => handleDelete(a.id)}
              aria-label="Remover alerta"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
