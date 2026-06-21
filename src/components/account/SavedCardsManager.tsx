import { useEffect, useState } from "react";
import { listSavedCards, deleteSavedCard } from "@/lib/saved-cards.functions";
import { CreditCard, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface SavedCard {
  id: string;
  last_four: string;
  brand: string | null;
  exp_month: number | null;
  exp_year: number | null;
  cardholder_name: string | null;
  created_at: string;
}

export function SavedCardsManager() {
  const [cards, setCards] = useState<SavedCard[] | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = async () => {
    try {
      const data = await listSavedCards({});
      setCards(data as SavedCard[]);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Erro ao carregar cartões");
      setCards([]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (id: string) => {
    if (!confirm("Remover este cartão? Você precisará informar os dados novamente no próximo pagamento.")) return;
    setRemoving(id);
    try {
      await deleteSavedCard({ data: { cardId: id } });
      toast.success("Cartão removido");
      setCards((prev) => (prev ?? []).filter((c) => c.id !== id));
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao remover cartão");
    } finally {
      setRemoving(null);
    }
  };

  if (cards === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando cartões...
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="rounded-lg border border-border bg-secondary/30 p-4 text-xs text-muted-foreground">
        Seus cartões são armazenados de forma segura no <strong>Mercado Pago</strong> (PCI-DSS Level 1).
        A Sevii guarda apenas a bandeira e os 4 últimos dígitos. Você pode remover a qualquer momento.
      </div>

      {cards.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <CreditCard className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            Nenhum cartão salvo. Marque "Salvar este cartão" ao finalizar um pagamento para guardá-lo.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {cards.map((c) => (
            <li key={c.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-3 min-w-0">
                <CreditCard className="h-5 w-5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold uppercase">
                    {c.brand ?? "Cartão"} ···· {c.last_four}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {c.cardholder_name ?? "—"}
                    {c.exp_month && c.exp_year && (
                      <> · expira {String(c.exp_month).padStart(2, "0")}/{String(c.exp_year).slice(-2)}</>
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={() => remove(c.id)}
                disabled={removing === c.id}
                className="shrink-0 inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
              >
                {removing === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                Remover
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
