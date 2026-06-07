import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import { adminAddAuctionCardsToStack } from "@/lib/admin-pilha.functions";
import { toast } from "sonner";
import { Trash2, Plus, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/admin/leiloes")({
  head: () => ({ meta: [{ title: "Leilões — Admin" }] }),
  component: AdminLeiloesPage,
});

type Item = {
  card_id: string;
  card_name: string;
  collection: string;
  card_number: string;
  finish: string;
  language: string;
  condition: string;
  quantity: number;
  unit_price_reais: string;
};

const emptyItem = (): Item => ({
  card_id: "",
  card_name: "",
  collection: "",
  card_number: "",
  finish: "Normal",
  language: "PT",
  condition: "NM",
  quantity: 1,
  unit_price_reais: "",
});

function AdminLeiloesPage() {
  const { isAdmin, loading } = useAuth();
  const nav = useNavigate();
  const addAuction = useServerFn(adminAddAuctionCardsToStack);

  const [customerEmail, setCustomerEmail] = useState("");
  const [auctionName, setAuctionName] = useState("");
  const [auctionDate, setAuctionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [sendEmail, setSendEmail] = useState(true);
  const [items, setItems] = useState<Item[]>([emptyItem()]);
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;
  if (!isAdmin) {
    nav({ to: "/" });
    return null;
  }

  const updateItem = (idx: number, patch: Partial<Item>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const addRow = () => setItems((prev) => [...prev, emptyItem()]);
  const removeRow = (idx: number) =>
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)));

  const totalCents = items.reduce((s, it) => {
    const cents = Math.round((parseFloat(it.unit_price_reais.replace(",", ".")) || 0) * 100);
    return s + cents * (Number(it.quantity) || 0);
  }, 0);
  const totalCards = items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerEmail.trim()) return toast.error("Informe o email do cliente.");
    if (!auctionName.trim()) return toast.error("Informe o nome do leilão.");
    if (!auctionDate) return toast.error("Informe a data do leilão.");

    const payloadItems = items
      .map((it) => {
        const name = it.card_name.trim();
        if (!name) return null;
        const cents = Math.round((parseFloat(it.unit_price_reais.replace(",", ".")) || 0) * 100);
        const cardId = it.card_id.trim() || `auction:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
        return {
          card_id: cardId,
          card_name: name,
          card_image: null,
          collection: it.collection.trim() || null,
          card_number: it.card_number.trim() || null,
          finish: it.finish || null,
          language: it.language || null,
          condition: it.condition || null,
          quantity: Number(it.quantity) || 1,
          unit_price_cents: cents,
        };
      })
      .filter((v): v is NonNullable<typeof v> => !!v);

    if (payloadItems.length === 0) return toast.error("Adicione ao menos uma carta com nome.");

    setSubmitting(true);
    try {
      const res = await addAuction({
        data: {
          customerEmail: customerEmail.trim(),
          auctionName: auctionName.trim(),
          auctionDate,
          items: payloadItems,
          sendEmail,
        },
      });
      toast.success(
        `${res.addedCount} carta(s) adicionada(s) à pilha de ${res.userName ?? customerEmail}.`,
      );
      setItems([emptyItem()]);
      setAuctionName("");
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao adicionar cartas.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/admin" className="hover:underline">Admin</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground font-semibold">Leilões</span>
      </div>
      <h1 className="text-2xl font-bold mb-1">Adicionar cartas de leilão à pilha</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Use este formulário para lançar cartas arrematadas em leilões manuais (WhatsApp)
        direto na Pilha de Cartas de um cliente já cadastrado no site.
      </p>

      <form onSubmit={onSubmit} className="space-y-6">
        <section className="rounded-lg border border-border bg-card p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="block font-semibold mb-1">Email do cliente</span>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                placeholder="cliente@email.com"
                required
              />
            </label>
            <label className="text-sm">
              <span className="block font-semibold mb-1">Data do leilão</span>
              <input
                type="date"
                value={auctionDate}
                onChange={(e) => setAuctionDate(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                required
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="block font-semibold mb-1">Nome do leilão</span>
              <input
                type="text"
                value={auctionName}
                onChange={(e) => setAuctionName(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                placeholder='Ex.: "Leilão Coleção 151 — 07/06"'
                required
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
            />
            Enviar email automático ao cliente avisando sobre as cartas
          </label>
        </section>

        <section className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-sm">Cartas arrematadas</h2>
            <button
              type="button"
              onClick={addRow}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar carta
            </button>
          </div>

          <div className="space-y-3">
            {items.map((it, idx) => (
              <div
                key={idx}
                className="rounded-md border border-border p-3 grid grid-cols-12 gap-2 items-start"
              >
                <input
                  type="text"
                  placeholder="Nome da carta *"
                  value={it.card_name}
                  onChange={(e) => updateItem(idx, { card_name: e.target.value })}
                  className="col-span-12 sm:col-span-5 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                />
                <input
                  type="text"
                  placeholder="Coleção"
                  value={it.collection}
                  onChange={(e) => updateItem(idx, { collection: e.target.value })}
                  className="col-span-7 sm:col-span-4 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                />
                <input
                  type="text"
                  placeholder="Nº"
                  value={it.card_number}
                  onChange={(e) => updateItem(idx, { card_number: e.target.value })}
                  className="col-span-5 sm:col-span-2 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                />
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  disabled={items.length === 1}
                  className="col-span-12 sm:col-span-1 inline-flex justify-center items-center rounded-md border border-border bg-background p-1.5 text-destructive hover:bg-destructive/10 disabled:opacity-40"
                  title="Remover"
                >
                  <Trash2 className="h-4 w-4" />
                </button>

                <select
                  value={it.finish}
                  onChange={(e) => updateItem(idx, { finish: e.target.value })}
                  className="col-span-4 sm:col-span-3 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                >
                  <option value="Normal">Normal</option>
                  <option value="Foil">Foil</option>
                  <option value="Reverse Foil">Reverse Foil</option>
                </select>
                <select
                  value={it.language}
                  onChange={(e) => updateItem(idx, { language: e.target.value })}
                  className="col-span-4 sm:col-span-2 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                >
                  <option value="PT">PT</option>
                  <option value="EN">EN</option>
                  <option value="JP">JP</option>
                  <option value="ES">ES</option>
                </select>
                <select
                  value={it.condition}
                  onChange={(e) => updateItem(idx, { condition: e.target.value })}
                  className="col-span-4 sm:col-span-2 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                >
                  <option value="NM">NM</option>
                  <option value="LP">LP</option>
                  <option value="MP">MP</option>
                  <option value="HP">HP</option>
                  <option value="DMG">DMG</option>
                </select>
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={it.quantity}
                  onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
                  className="col-span-6 sm:col-span-2 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                  placeholder="Qtd"
                />
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Preço un. (R$)"
                  value={it.unit_price_reais}
                  onChange={(e) => updateItem(idx, { unit_price_reais: e.target.value })}
                  className="col-span-6 sm:col-span-3 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                />
              </div>
            ))}
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-secondary/30 p-4">
          <div className="text-sm">
            <p>
              <strong>{totalCards}</strong> carta(s) ·{" "}
              <strong>
                {(totalCents / 100).toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </strong>{" "}
              em valor de leilão
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              As cartas serão guardadas na pilha ativa do cliente (criando uma nova se necessário).
            </p>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Lançando…" : "Lançar na pilha do cliente"}
          </button>
        </div>
      </form>
    </main>
  );
}
