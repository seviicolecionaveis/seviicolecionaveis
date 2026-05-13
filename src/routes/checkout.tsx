import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { supabase } from "@/integrations/supabase/client";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createOrderCheckout, createPixOrder, checkPixOrderStatus } from "@/utils/payments.functions";
import { toast } from "sonner";
import { Copy, Check, QrCode } from "lucide-react";

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Checkout — Sevii Colecionáveis" }] }),
  component: CheckoutPage,
});

const SHIPPING_FIXED = 25;

interface Form {
  recipientName: string;
  cpf: string;
  phone: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  notes: string;
  favPokemon1: string;
  favPokemon2: string;
  favPokemon3: string;
  couponCode: string;
}

const empty: Form = {
  recipientName: "",
  cpf: "",
  phone: "",
  cep: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  notes: "",
  favPokemon1: "",
  favPokemon2: "",
  favPokemon3: "",
  couponCode: "",
};

type PaymentMethod = "pix" | "card";
type Step = "address" | "method" | "card" | "pix";

interface PixState {
  orderId: string;
  qrCode: string;
  qrCodeBase64: string;
  expiresAt: string;
  totalCents: number;
}

function CheckoutPage() {
  const { user, session, loading: authLoading } = useAuth();
  const { items, subtotal, clear } = useCart();
  const nav = useNavigate();
  const [form, setForm] = useState<Form>(empty);
  const [shipping, setShipping] = useState<"fixed" | "arrange">("fixed");
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [step, setStep] = useState<Step>("address");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [stripeOrderId, setStripeOrderId] = useState<string | null>(null);
  const [pix, setPix] = useState<PixState | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Detect cart expired notice (?expired=1)
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("expired=1")) {
      toast.warning("Seu carrinho expirou", {
        description: "A reserva de 5 minutos terminou. Os itens voltaram a ficar disponíveis.",
      });
      const u = new URL(window.location.href);
      u.searchParams.delete("expired");
      window.history.replaceState({}, "", u.toString());
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) nav({ to: "/auth" });
  }, [authLoading, user, nav]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, cpf, phone")
        .eq("user_id", user.id)
        .maybeSingle();
      const { data: addr } = await supabase
        .from("addresses")
        .select("*")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false })
        .limit(1)
        .maybeSingle();
      setForm((f) => ({
        ...f,
        recipientName: addr?.recipient_name ?? profile?.full_name ?? "",
        cpf: profile?.cpf ?? "",
        phone: profile?.phone ?? "",
        cep: addr?.cep ?? "",
        street: addr?.street ?? "",
        number: addr?.number ?? "",
        complement: addr?.complement ?? "",
        neighborhood: addr?.neighborhood ?? "",
        city: addr?.city ?? "",
        state: addr?.state ?? "",
      }));
    })();
  }, [user]);

  const lookupCep = async (cep: string) => {
    const clean = cep.replace(/\D/g, "");
    if (clean.length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const j = await r.json();
      if (!j.erro) {
        setForm((f) => ({
          ...f,
          street: j.logradouro || f.street,
          neighborhood: j.bairro || f.neighborhood,
          city: j.localidade || f.city,
          state: j.uf || f.state,
        }));
      }
    } catch {}
  };

  const shippingCost = shipping === "fixed" ? SHIPPING_FIXED : 0;
  const couponNormalized = form.couponCode.trim().toUpperCase();
  const couponInfo = (() => {
    if (couponNormalized === "POKEAGIOTAGEM") return { valid: true, percent: 30, label: "POKEAGIOTAGEM −30% (admin)" };
    if (couponNormalized === "PRIMEIRACOMPRA10") return { valid: true, percent: 10, label: "PRIMEIRACOMPRA10 −10% (1ª compra)" };
    return { valid: false, percent: 0, label: "" };
  })();
  const discount = couponInfo.valid ? subtotal * (couponInfo.percent / 100) : 0;
  const total = subtotal - discount + shippingCost;

  const persistAddressAndProfile = async () => {
    if (!user) return;
    await supabase
      .from("profiles")
      .update({ full_name: form.recipientName, cpf: form.cpf, phone: form.phone })
      .eq("user_id", user.id);
    await supabase.from("addresses").insert({
      user_id: user.id,
      recipient_name: form.recipientName,
      cep: form.cep,
      street: form.street,
      number: form.number,
      complement: form.complement || null,
      neighborhood: form.neighborhood,
      city: form.city,
      state: form.state.toUpperCase(),
      is_default: true,
    });
  };

  const buildAddressPayload = () => ({
    recipientName: form.recipientName,
    cpf: form.cpf || null,
    phone: form.phone,
    cep: form.cep,
    street: form.street,
    number: form.number,
    complement: form.complement || null,
    neighborhood: form.neighborhood,
    city: form.city,
    state: form.state.toUpperCase(),
  });

  const buildItemsPayload = () =>
    items.map((i) => ({
      cardId: i.cardId,
      name: i.name,
      image: i.image,
      collection: i.collection,
      number: i.number,
      finish: i.finish,
      language: i.language,
      condition: i.condition,
      unitPrice: i.unitPrice,
      quantity: i.quantity,
    }));

  const buildNotes = () => {
    const favs = [form.favPokemon1, form.favPokemon2, form.favPokemon3]
      .map((p) => p.trim())
      .filter(Boolean);
    const favsLine = favs.length ? `Pokémons favoritos: ${favs.join(", ")}` : "";
    const combined = [favsLine, form.notes.trim()].filter(Boolean).join("\n\n");
    return combined || null;
  };

  const handleAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setStep("method");
  };

  const startStripe = async () => {
    if (!user || items.length === 0) return;
    setLoading(true);
    setErr(null);
    try {
      await persistAddressAndProfile();
      const token = session?.access_token;
      if (!token) throw new Error("Sessão expirada. Faça login novamente.");
      const result = await createOrderCheckout({
        headers: { Authorization: `Bearer ${token}` },
        data: {
          items: buildItemsPayload(),
          shippingMethod: shipping,
          address: buildAddressPayload(),
          notes: buildNotes(),
          couponCode: couponNormalized || null,
          returnUrl: `${window.location.origin}/orders/__ORDER__?session_id={CHECKOUT_SESSION_ID}`,
          environment: getStripeEnvironment(),
        },
      });
      setClientSecret(result.clientSecret);
      setStripeOrderId(result.orderId);
      setStep("card");
      clear();
    } catch (e: any) {
      setErr(e?.message ?? "Erro ao iniciar pagamento");
    } finally {
      setLoading(false);
    }
  };

  const startPix = async () => {
    if (!user || items.length === 0) return;
    setLoading(true);
    setErr(null);
    try {
      await persistAddressAndProfile();
      const token = session?.access_token;
      if (!token) throw new Error("Sessão expirada. Faça login novamente.");
      const result = await createPixOrder({
        headers: { Authorization: `Bearer ${token}` },
        data: {
          items: buildItemsPayload(),
          shippingMethod: shipping,
          address: buildAddressPayload(),
          notes: buildNotes(),
          couponCode: couponNormalized || null,
        },
      });
      setPix(result);
      setStep("pix");
      clear();
    } catch (e: any) {
      setErr(e?.message ?? "Erro ao gerar Pix");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Carregando...</div>;
  if (!user) return null;

  if (items.length === 0 && step === "address") {
    return (
      <div className="min-h-screen grid place-items-center px-4">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Seu carrinho está vazio.</p>
          <Link to="/" className="mt-4 inline-block text-sm font-semibold underline">
            Voltar ao catálogo
          </Link>
        </div>
      </div>
    );
  }

  if (step === "card" && clientSecret) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border px-4 py-4">
          <div className="mx-auto max-w-3xl flex items-center justify-between">
            <Link to="/" className="text-sm font-bold uppercase tracking-widest">Sevii Colecionáveis</Link>
            <button onClick={() => setStep("method")} className="text-xs text-muted-foreground hover:text-foreground">
              ← Voltar
            </button>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-8">
          <h1 className="text-2xl font-bold mb-6">Pagamento — Cartão</h1>
          <div id="checkout">
            <EmbeddedCheckoutProvider stripe={getStripe()} options={{ clientSecret }}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        </main>
      </div>
    );
  }

  if (step === "pix" && pix) {
    return <PixScreen pix={pix} />;
  }

  if (step === "method") {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border px-4 py-4">
          <div className="mx-auto max-w-3xl flex items-center justify-between">
            <Link to="/" className="text-sm font-bold uppercase tracking-widest">Sevii Colecionáveis</Link>
            <button onClick={() => setStep("address")} className="text-xs text-muted-foreground hover:text-foreground">
              ← Voltar
            </button>
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-4 py-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Forma de pagamento</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Total: <span className="font-semibold text-foreground">R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            </p>
          </div>

          <div className="space-y-3">
            <label className="flex items-start gap-3 rounded-lg border border-border p-4 cursor-pointer hover:bg-secondary/50">
              <input type="radio" checked={method === "pix"} onChange={() => setMethod("pix")} className="mt-1" />
              <div className="flex-1">
                <p className="text-sm font-semibold">⚡ Pix — aprovação imediata</p>
                <p className="text-xs text-muted-foreground">QR Code via Mercado Pago. Estoque reservado por 5 min.</p>
              </div>
            </label>
            <label className="flex items-start gap-3 rounded-lg border border-border p-4 cursor-pointer hover:bg-secondary/50">
              <input type="radio" checked={method === "card"} onChange={() => setMethod("card")} className="mt-1" />
              <div className="flex-1">
                <p className="text-sm font-semibold">💳 Cartão de crédito</p>
                <p className="text-xs text-muted-foreground">Pagamento seguro via Stripe.</p>
              </div>
            </label>
          </div>

          {err && <p className="text-sm text-red-600">{err}</p>}

          <button
            onClick={method === "pix" ? startPix : startStripe}
            disabled={loading}
            className="w-full rounded-full bg-foreground py-3 text-sm font-semibold uppercase tracking-wide text-background hover:bg-foreground/90 disabled:opacity-50"
          >
            {loading ? "Processando..." : method === "pix" ? "Gerar QR Code Pix" : "Pagar com cartão"}
          </button>
        </main>
      </div>
    );
  }

  // step === "address"
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-4">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <Link to="/" className="text-sm font-bold uppercase tracking-widest">Sevii Colecionáveis</Link>
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">← Catálogo</Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 grid lg:grid-cols-[1fr_360px] gap-8">
        <form onSubmit={handleAddressSubmit} className="space-y-6">
          <h1 className="text-2xl font-bold">Endereço de entrega</h1>

          <div className="grid gap-4">
            <Field label="Nome completo do destinatário" required value={form.recipientName} onChange={(v) => setForm({ ...form, recipientName: v })} />
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="CPF" value={form.cpf} onChange={(v) => setForm({ ...form, cpf: v })} placeholder="000.000.000-00" />
              <Field label="Telefone / WhatsApp" required value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="(11) 90000-0000" />
            </div>
            <div className="grid sm:grid-cols-[160px_1fr] gap-4">
              <Field label="CEP" required value={form.cep} onChange={(v) => setForm({ ...form, cep: v })} onBlur={() => lookupCep(form.cep)} placeholder="00000-000" />
              <Field label="Rua / Logradouro" required value={form.street} onChange={(v) => setForm({ ...form, street: v })} />
            </div>
            <div className="grid sm:grid-cols-[120px_1fr] gap-4">
              <Field label="Número" required value={form.number} onChange={(v) => setForm({ ...form, number: v })} />
              <Field label="Complemento" value={form.complement} onChange={(v) => setForm({ ...form, complement: v })} />
            </div>
            <Field label="Bairro" required value={form.neighborhood} onChange={(v) => setForm({ ...form, neighborhood: v })} />
            <div className="grid sm:grid-cols-[1fr_120px] gap-4">
              <Field label="Cidade" required value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
              <Field label="UF" required value={form.state} onChange={(v) => setForm({ ...form, state: v.toUpperCase().slice(0, 2) })} placeholder="SP" />
            </div>
          </div>

          <div>
            <h2 className="text-lg font-bold mb-3">Envio</h2>
            <div className="space-y-2">
              <label className="flex items-start gap-3 rounded-lg border border-border p-4 cursor-pointer hover:bg-secondary/50">
                <input type="radio" name="ship" checked={shipping === "fixed"} onChange={() => setShipping("fixed")} className="mt-1" />
                <div className="flex-1">
                  <p className="text-sm font-semibold">🚚 Mini Envios — R$ 25,00</p>
                  <p className="text-xs text-muted-foreground">Envio rastreado pelos Correios — frete fixo Brasil todo.</p>
                </div>
              </label>
              <label className="flex items-start gap-3 rounded-lg border border-border p-4 cursor-pointer hover:bg-secondary/50">
                <input type="radio" name="ship" checked={shipping === "arrange"} onChange={() => setShipping("arrange")} className="mt-1" />
                <div className="flex-1">
                  <p className="text-sm font-semibold">🤝 Combinar envio com vendedor</p>
                  <p className="text-xs text-muted-foreground">Sem cobrança de frete agora — combinamos via WhatsApp depois.</p>
                </div>
              </label>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-bold mb-1">Conte pra gente! ⭐</h2>
            <p className="text-xs text-muted-foreground mb-3">Quais são seus 3 Pokémons favoritos? (opcional)</p>
            <div className="grid sm:grid-cols-3 gap-3">
              <Field label="Favorito #1" value={form.favPokemon1} onChange={(v) => setForm({ ...form, favPokemon1: v })} placeholder="Ex: Pikachu" />
              <Field label="Favorito #2" value={form.favPokemon2} onChange={(v) => setForm({ ...form, favPokemon2: v })} placeholder="Ex: Charizard" />
              <Field label="Favorito #3" value={form.favPokemon3} onChange={(v) => setForm({ ...form, favPokemon3: v })} placeholder="Ex: Mew" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wide mb-1">Cupom de desconto (opcional)</label>
            <input
              value={form.couponCode}
              onChange={(e) => setForm({ ...form, couponCode: e.target.value.toUpperCase() })}
              placeholder="Ex: PRIMEIRACOMPRA10"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-foreground"
            />
            {couponInfo.valid && (
              <p className="mt-1 text-xs text-green-600 font-semibold">✓ Cupom aplicado: {couponInfo.label}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wide mb-1">Observações (opcional)</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground"
            />
          </div>

          {err && <p className="text-sm text-red-600">{err}</p>}

          <button
            type="submit"
            className="w-full rounded-full bg-foreground py-3 text-sm font-semibold uppercase tracking-wide text-background hover:bg-foreground/90"
          >
            Continuar — R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </button>
        </form>

        <aside className="lg:sticky lg:top-8 h-fit rounded-xl border border-border p-5 bg-card">
          <h2 className="text-sm font-bold uppercase tracking-widest mb-4">Resumo</h2>
          <ul className="space-y-3 text-sm">
            {items.map((i) => (
              <li key={i.id} className="flex justify-between gap-2">
                <span className="truncate">
                  {i.quantity}× {i.name}
                  <span className="block text-[10px] text-muted-foreground">{i.collection} · #{i.number}</span>
                  <span className="block text-[10px] text-muted-foreground">{i.finish} · {i.language} · {i.condition}</span>
                </span>
                <span className="tabular-nums shrink-0">
                  R$ {(i.unitPrice * i.quantity).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 border-t border-border pt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">R$ {subtotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            </div>
            {couponInfo.valid && (
              <div className="flex justify-between text-green-600">
                <span>Desconto −{couponInfo.percent}%</span>
                <span className="tabular-nums">− R$ {discount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Frete</span>
              <span className="tabular-nums">
                {shipping === "fixed" ? `R$ ${SHIPPING_FIXED.toFixed(2).replace(".", ",")}` : "A combinar"}
              </span>
            </div>
            <div className="flex justify-between text-base font-bold pt-2 border-t border-border">
              <span>Total</span>
              <span className="tabular-nums">R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}

function PixScreen({ pix }: { pix: PixState }) {
  const { session } = useAuth();
  const nav = useNavigate();
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<"pending" | "paid" | "cancelled">("pending");
  const [secondsLeft, setSecondsLeft] = useState(() => {
    return Math.max(0, Math.floor((new Date(pix.expiresAt).getTime() - Date.now()) / 1000));
  });
  const polling = useRef(true);

  useEffect(() => {
    polling.current = true;
    const tick = async () => {
      if (!polling.current || !session?.access_token) return;
      try {
        const r = await checkPixOrderStatus({
          headers: { Authorization: `Bearer ${session.access_token}` },
          data: { orderId: pix.orderId },
        });
        if (r.status === "paid") {
          polling.current = false;
          setStatus("paid");
          setTimeout(() => nav({ to: "/checkout/return", search: { session_id: pix.orderId } }), 1500);
        } else if (r.status === "cancelled") {
          polling.current = false;
          setStatus("cancelled");
        }
      } catch (e) {
        console.error(e);
      }
    };
    tick();
    const interval = setInterval(tick, 5000);
    return () => {
      polling.current = false;
      clearInterval(interval);
    };
  }, [pix.orderId, session, nav]);

  useEffect(() => {
    const t = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const copy = async () => {
    await navigator.clipboard.writeText(pix.qrCode);
    setCopied(true);
    toast.success("Código Pix copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const total = (pix.totalCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-4">
        <div className="mx-auto max-w-2xl flex items-center justify-between">
          <Link to="/" className="text-sm font-bold uppercase tracking-widest">Sevii Colecionáveis</Link>
        </div>
      </header>
      <main className="mx-auto max-w-xl px-4 py-8 space-y-6">
        <div className="text-center">
          <QrCode className="h-8 w-8 mx-auto mb-2" />
          <h1 className="text-2xl font-bold">Pague com Pix</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Total: <span className="font-semibold text-foreground">R$ {total}</span>
          </p>
        </div>

        {status === "paid" && (
          <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-center">
            <p className="text-sm font-semibold text-green-800">✓ Pagamento confirmado! Redirecionando...</p>
          </div>
        )}

        {status === "cancelled" && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-center">
            <p className="text-sm font-semibold text-red-800">Este Pix foi cancelado ou expirou.</p>
            <Link to="/" className="mt-2 inline-block text-xs underline">Voltar ao catálogo</Link>
          </div>
        )}

        {status === "pending" && (
          <>
            <div className="rounded-xl border border-border p-6 bg-card flex flex-col items-center">
              <img
                src={`data:image/png;base64,${pix.qrCodeBase64}`}
                alt="QR Code Pix"
                className="h-64 w-64 rounded-lg bg-white p-2"
              />
              <p className="mt-3 text-xs text-muted-foreground">
                Expira em <span className="font-mono font-semibold text-foreground">{mm}:{ss}</span>
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wide mb-2">
                Pix Copia e Cola
              </label>
              <div className="flex gap-2">
                <textarea
                  readOnly
                  value={pix.qrCode}
                  rows={3}
                  className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-xs font-mono resize-none"
                />
                <button
                  onClick={copy}
                  className="shrink-0 rounded-md bg-foreground text-background px-4 text-xs font-semibold hover:bg-foreground/90 flex items-center gap-1"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copiado" : "Copiar"}
                </button>
              </div>
            </div>

            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Abra o app do seu banco</li>
              <li>Escaneie o QR ou cole o código Pix</li>
              <li>Confirme o pagamento — a confirmação chega aqui automaticamente</li>
            </ol>
          </>
        )}
      </main>
    </div>
  );
}

function Field({
  label, value, onChange, onBlur, required, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void;
  onBlur?: () => void; required?: boolean; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium uppercase tracking-wide mb-1">
        {label}{required && <span className="text-red-600"> *</span>}
      </label>
      <input
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground"
      />
    </div>
  );
}
