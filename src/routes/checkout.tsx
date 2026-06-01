import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useId, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { supabase } from "@/integrations/supabase/client";
import {
  createPixOrder,
  checkPixOrderStatus,
  createCardOrder,
  getMercadoPagoPublicKey,
  previewCoupon,
} from "@/utils/payments.functions";
import { validateArteEmCardsCode, getMyArteEmCardsCode } from "@/lib/arte-em-cards.functions";
import { getShippingQuotes } from "@/utils/shipping.functions";
import { toast } from "sonner";
import { Copy, Check, QrCode, CreditCard, Loader2, Sparkles } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { TrustBadges } from "@/components/TrustBadges";
import { computeBundleDiscount } from "@/lib/bundles";
import { copyToClipboard } from "@/lib/clipboard";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — Sevii Colecionáveis" },
      { name: "description", content: "Finalize seu pedido de cartas Pokémon na Sevii Colecionáveis. Pagamento seguro via Pix." },
      { property: "og:title", content: "Checkout — Sevii Colecionáveis" },
      { property: "og:description", content: "Finalize seu pedido com segurança." },
      { property: "og:url", content: "https://seviicolecionaveis.lovable.app/checkout" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CheckoutPage,
});



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

type Step = "address" | "pix" | "card";
type PaymentMethod = "pix" | "card";

interface PixState {
  orderId: string;
  qrCode: string;
  qrCodeBase64: string;
  expiresAt: string;
  totalCents: number;
}

interface ItemPayload {
  cardId: string; name: string; image?: string | null;
  collection?: string | null; number?: string | null;
  finish: string; language: string; condition?: string | null;
  unitPrice: number; quantity: number;
}
interface AddressPayload {
  recipientName: string; cpf: string | null; phone: string;
  cep: string; street: string; number: string; complement: string | null;
  neighborhood: string; city: string; state: string;
}

interface ShippingQuote {
  id: string;
  serviceId: number;
  serviceName: string;
  company: string;
  priceCents: number;
  deliveryDays: number | null;
}

interface CardState {
  totalCents: number;
  payerEmail: string;
  payerCpf: string | null;
  itemsPayload: ItemPayload[];
  shipping: "fixed" | "arrange";
  shippingQuote: ShippingQuote | null;
  address: AddressPayload;
  notes: string | null;
  couponCode: string | null;
}

function CheckoutPage() {
  const { user, session, loading: authLoading } = useAuth();
  const { items, subtotal, clear } = useCart();
  const nav = useNavigate();
  const [form, setForm] = useState<Form>(empty);
  const [shipping, setShipping] = useState<"fixed" | "arrange" | "arte_em_cards">("fixed");
  const [pickupPoint, setPickupPoint] = useState<"aruana" | "aeroporto" | "app" | null>(null);
  const [arteCode, setArteCode] = useState("");
  const [arteCodeStatus, setArteCodeStatus] = useState<
    | { state: "idle" }
    | { state: "checking" }
    | { state: "valid"; code: string; cycleEnd: string }
    | { state: "invalid"; reason: string }
  >({ state: "idle" });
  const [arteExistingCode, setArteExistingCode] = useState<{ code: string; cycleEnd: string } | null>(null);
  const ARTE_FEE_CENTS = 500;
  const [quotes, setQuotes] = useState<ShippingQuote[]>([]);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [quotesError, setQuotesError] = useState<string | null>(null);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
  const [step, setStep] = useState<Step>("address");
  const [pix, setPix] = useState<PixState | null>(null);
  const [card, setCard] = useState<CardState | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [couponPreview, setCouponPreview] = useState<
    | { valid: true; discountCents: number; code: string; label: string; kind: "amount" | "percent"; percent: number | null; amountCents: number | null }
    | { valid: false; error: string }
    | null
  >(null);
  const [couponChecking, setCouponChecking] = useState(false);

  const selectedQuote = quotes.find((q) => q.id === selectedQuoteId) ?? null;

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

  const itemsCount = items.reduce((s, i) => s + i.quantity, 0);

  // Dispara cotação automaticamente quando CEP fica válido (ex: pré-preenchido do perfil)
  useEffect(() => {
    const clean = form.cep.replace(/\D/g, "");
    if (clean.length === 8 && itemsCount > 0 && quotes.length === 0 && !quotesLoading && !quotesError) {
      fetchQuotes(clean);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.cep, itemsCount]);

  const fetchQuotes = async (cep: string) => {
    const clean = cep.replace(/\D/g, "");
    if (clean.length !== 8 || itemsCount === 0) return;
    setQuotesLoading(true);
    setQuotesError(null);
    try {
      const r = await getShippingQuotes({ data: { destinationCep: clean, itemsCount } });
      if (r.error) {
        setQuotesError(r.error);
        setQuotes([]);
        setSelectedQuoteId(null);
      } else {
        setQuotes(r.quotes);
        setSelectedQuoteId((prev) =>
          prev && r.quotes.some((q) => q.id === prev) ? prev : (r.quotes[0]?.id ?? null),
        );
      }
    } catch (e: any) {
      setQuotesError(e?.message ?? "Falha ao consultar frete.");
      setQuotes([]);
      setSelectedQuoteId(null);
    } finally {
      setQuotesLoading(false);
    }
  };

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
    fetchQuotes(clean);
  };

  const shippingCents =
    shipping === "fixed" ? (selectedQuote ? selectedQuote.priceCents : 0) : 0;
  const shippingCost = shippingCents / 100;
  const couponNormalized = form.couponCode.trim().toUpperCase();
  const PIX_DISCOUNT_PERCENT = 5;

  const subtotalCents = Math.round(subtotal * 100);
  const bundle = computeBundleDiscount(items);
  const bundleDiscountCents = bundle.bundleDiscountCents;
  const bundleSubtotalCents = bundle.bundleSubtotalCents;
  // Base sobre a qual cupom e Pix podem incidir (exclui itens em combo)
  const nonBundleSubtotalCents = Math.max(0, subtotalCents - bundleSubtotalCents);

  // Valida cupom no servidor (debounced) — cobre cupons da tabela `coupons` (vales-presente, broadcasts)
  useEffect(() => {
    if (!couponNormalized || !user) {
      setCouponPreview(null);
      setCouponChecking(false);
      return;
    }
    setCouponChecking(true);
    const handle = setTimeout(async () => {
      try {
        const res = await previewCoupon({
          data: { code: couponNormalized, subtotalCents: nonBundleSubtotalCents },
        });
        setCouponPreview(res);
      } catch (e) {
        setCouponPreview({ valid: false, error: e instanceof Error ? e.message : "Cupom inválido" });
      } finally {
        setCouponChecking(false);
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [couponNormalized, nonBundleSubtotalCents, user]);

  const couponDiscountCents =
    couponPreview && couponPreview.valid && couponPreview.code === couponNormalized
      ? Math.min(couponPreview.discountCents, nonBundleSubtotalCents)
      : 0;

  const pixDiscountCents =
    paymentMethod === "pix"
      ? Math.round(
          Math.max(0, nonBundleSubtotalCents - couponDiscountCents) * (PIX_DISCOUNT_PERCENT / 100),
        )
      : 0;
  const totalCents =
    subtotalCents - bundleDiscountCents - couponDiscountCents - pixDiscountCents + shippingCents;

  const discount = couponDiscountCents / 100;
  const pixDiscount = pixDiscountCents / 100;
  const bundleDiscount = bundleDiscountCents / 100;
  const total = totalCents / 100;

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

  const PICKUP_LABELS: Record<"aruana" | "aeroporto" | "app", string> = {
    aruana: "Aruana — Rua Josepha Andrade Irmã Fontes, 600, Residencial Vista Aruana",
    aeroporto: "Aeroporto — Av. Silvério Leite Fontes, 1128, Palm Ville Residence",
    app: "Entrega por aplicativo (Uber/99)",
  };

  const buildNotes = () => {
    const favs = [form.favPokemon1, form.favPokemon2, form.favPokemon3]
      .map((p) => p.trim())
      .filter(Boolean);
    const favsLine = favs.length ? `Pokémons favoritos: ${favs.join(", ")}` : "";
    const pickupLine =
      shipping === "arrange" && pickupPoint
        ? pickupPoint === "app"
          ? `Entrega por aplicativo (Uber/99): cliente solicitará disponibilidade pelo WhatsApp.`
          : `Retirada em mãos: ${PICKUP_LABELS[pickupPoint]}. Horário: tarde das 14h às 18h em dias úteis, mediante contato pela manhã do mesmo dia.`
        : "";
    const combined = [pickupLine, favsLine, form.notes.trim()].filter(Boolean).join("\n\n");
    return combined || null;
  };

  const handleAddressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    trackEvent("begin_checkout", {
      currency: "BRL",
      value: subtotal,
      items: items.map((i) => ({
        item_id: i.id,
        item_name: i.name,
        item_category: i.collection,
        item_variant: `${i.finish}/${i.language}/${i.condition}`,
        price: i.unitPrice,
        quantity: i.quantity,
      })),
    });
    if (paymentMethod === "card") {
      await startCard();
    } else {
      await startPix();
    }
  };

  const shippingQuotePayload = (): ShippingQuote | null =>
    shipping === "fixed" && selectedQuote ? selectedQuote : null;

  const shippingQuoteForApi = () => {
    const q = shippingQuotePayload();
    if (!q) return null;
    return {
      serviceId: String(q.serviceId),
      serviceName: q.serviceName,
      company: q.company,
      priceCents: q.priceCents,
    };
  };

  const validateShippingChoice = (): string | null => {
    if (shipping === "fixed" && !selectedQuote) {
      return "Selecione uma opção de frete (informe o CEP para carregar).";
    }
    if (shipping === "arrange" && !pickupPoint) {
      return "Selecione uma opção: Aruana, Aeroporto ou Entrega por aplicativo.";
    }
    return null;
  };

  const startCard = async () => {
    if (!user || items.length === 0) return;
    const shipErr = validateShippingChoice();
    if (shipErr) { setErr(shipErr); return; }
    setLoading(true);
    setErr(null);
    try {
      try {
        await persistAddressAndProfile();
      } catch (e) {
        console.warn("persistAddressAndProfile falhou (seguindo mesmo assim):", e);
      }
      // O servidor recalcula tudo (combo + cupom + Pix) por segurança;
      // aqui só passamos o totalCents já calculado para exibir no CardBrick.
      setCard({
        totalCents,
        payerEmail: user.email ?? "",
        payerCpf: form.cpf || null,
        itemsPayload: buildItemsPayload(),
        shipping,
        shippingQuote: shippingQuotePayload(),
        address: buildAddressPayload(),
        notes: buildNotes(),
        couponCode: couponNormalized || null,
      });
      setStep("card");
    } catch (e: any) {
      console.error("startCard error:", e);
      setErr(e?.message ?? "Erro ao iniciar pagamento com cartão");
    } finally {
      setLoading(false);
    }
  };

  const startPix = async () => {
    if (!user || items.length === 0) return;
    const shipErr = validateShippingChoice();
    if (shipErr) { setErr(shipErr); return; }
    setLoading(true);
    setErr(null);
    try {
      try {
        await persistAddressAndProfile();
      } catch (e) {
        console.warn("persistAddressAndProfile falhou (seguindo mesmo assim):", e);
      }
      const token = session?.access_token;
      if (!token) throw new Error("Sessão expirada. Faça login novamente.");
      const result = await createPixOrder({
        headers: { Authorization: `Bearer ${token}` },
        data: {
          items: buildItemsPayload(),
          shippingMethod: shipping,
          shippingQuote: shippingQuoteForApi(),
          address: buildAddressPayload(),
          notes: buildNotes(),
          couponCode: couponNormalized || null,
        },
      });
      setPix(result);
      setStep("pix");
      clear();
    } catch (e: any) {
      console.error("startPix error:", e);
      setErr(e?.message ?? "Erro ao gerar Pix. Tente novamente em alguns segundos.");
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

  if (step === "pix" && pix) {
    return <PixScreen pix={pix} />;
  }

  if (step === "card" && card) {
    return <CardScreen card={card} onBack={() => setStep("address")} onSuccess={(orderId) => { clear(); nav({ to: "/orders/$orderId", params: { orderId } }); }} />;
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
              <div className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold">🚚 Frete rastreado (Superfrete)</p>
                  {quotesLoading && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Cotando...
                    </span>
                  )}
                </div>
                {!form.cep && (
                  <p className="text-xs text-muted-foreground">Informe o CEP acima para ver as opções de frete.</p>
                )}
                {form.cep && !quotesLoading && quotes.length === 0 && !quotesError && (
                  <p className="text-xs text-muted-foreground">Aguardando cotação...</p>
                )}
                {quotesError && (
                  <div className="text-xs text-amber-700">
                    {quotesError}{" "}
                    <button
                      type="button"
                      onClick={() => fetchQuotes(form.cep)}
                      className="underline font-semibold"
                    >
                      Tentar novamente
                    </button>
                  </div>
                )}
                {quotes.length > 0 && (
                  <div className="space-y-2 mt-2">
                    {quotes.map((q) => {
                      const checked = shipping === "fixed" && selectedQuoteId === q.id;
                      return (
                        <label
                          key={q.id}
                          className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer transition ${
                            checked ? "border-foreground bg-secondary/50" : "border-border hover:bg-secondary/30"
                          }`}
                        >
                          <input
                            type="radio"
                            name="ship"
                            checked={checked}
                            onChange={() => {
                              setShipping("fixed");
                              setSelectedQuoteId(q.id);
                              trackEvent("add_shipping_info", {
                                currency: "BRL",
                                value: subtotal + q.priceCents / 100,
                                shipping_tier: `${q.company} — ${q.serviceName}`,
                                items: items.map((i) => ({
                                  item_id: i.id,
                                  item_name: i.name,
                                  item_category: i.collection,
                                  price: i.unitPrice,
                                  quantity: i.quantity,
                                })),
                              });
                            }}
                            className="mt-1"
                          />
                          <div className="flex-1 flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold">
                                {q.serviceName}{" "}
                                <span className="text-xs text-muted-foreground font-normal">— {q.company}</span>
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {q.deliveryDays ? `Entrega em até ${q.deliveryDays} dia(s) úteis` : "Prazo a definir"}
                              </p>
                            </div>
                            <span className="text-sm font-bold tabular-nums">
                              R$ {(q.priceCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="rounded-lg border border-border">
                <label className="flex items-start gap-3 p-4 cursor-pointer hover:bg-secondary/50">
                  <input
                    type="radio"
                    name="ship"
                    checked={shipping === "arrange" && pickupPoint !== "app"}
                    onChange={() => {
                      setShipping("arrange");
                      if (pickupPoint === "app") setPickupPoint(null);
                    }}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-semibold">Retirada em mãos (somente em Aracaju)</p>
                    <p className="text-xs text-muted-foreground">Escolha um dos pontos de retirada abaixo</p>
                  </div>
                </label>
                {shipping === "arrange" && pickupPoint !== "app" && (
                  <div className="px-4 pb-4 space-y-2">
                    <label className="flex items-start gap-3 rounded-md border border-border p-3 cursor-pointer hover:bg-secondary/50">
                      <input
                        type="radio"
                        name="pickup"
                        checked={pickupPoint === "aruana"}
                        onChange={() => setPickupPoint("aruana")}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-semibold">Aruana</p>
                        <p className="text-xs text-muted-foreground">
                          Rua Josepha Andrade Irmã Fontes, 600 — Residencial Vista Aruana
                        </p>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 rounded-md border border-border p-3 cursor-pointer hover:bg-secondary/50">
                      <input
                        type="radio"
                        name="pickup"
                        checked={pickupPoint === "aeroporto"}
                        onChange={() => setPickupPoint("aeroporto")}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-semibold">Aeroporto</p>
                        <p className="text-xs text-muted-foreground">
                          Av. Silvério Leite Fontes, 1128 — Palm Ville Residence
                        </p>
                      </div>
                    </label>
                    {pickupPoint && (
                      <div className="rounded-md bg-secondary/60 border border-border p-3 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">Atenção:</span> retiradas são feitas no período da
                        tarde, das <span className="font-semibold text-foreground">14h às 18h</span>, em qualquer dia útil
                        da semana, desde que você entre em contato com a gente pela manhã do mesmo dia.
                      </div>
                    )}
                  </div>
                )}
              </div>
              <label className="flex items-start gap-3 rounded-lg border border-border p-4 cursor-pointer hover:bg-secondary/50">
                <input
                  type="radio"
                  name="ship"
                  checked={shipping === "arrange" && pickupPoint === "app"}
                  onChange={() => {
                    setShipping("arrange");
                    setPickupPoint("app");
                  }}
                  className="mt-1"
                />
                <div className="flex-1">
                  <p className="text-sm font-semibold">Entrega por aplicativo (Uber / 99)</p>
                  <p className="text-xs text-muted-foreground">
                    Após a compra, solicite a disponibilidade pelo WhatsApp — o valor da corrida é por sua conta.
                  </p>
                  {shipping === "arrange" && pickupPoint === "app" && (
                    <div className="mt-2 rounded-md bg-secondary/60 border border-border p-3 text-xs text-muted-foreground">
                      Assim que o pedido for confirmado, abra o pedido em <span className="font-semibold text-foreground">Meus pedidos</span> e
                      clique no botão <span className="font-semibold text-foreground">"Solicitar entrega por aplicativo"</span> para falar com a loja no WhatsApp.
                    </div>
                  )}
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
            {couponNormalized && couponChecking && (
              <p className="mt-1 text-xs text-muted-foreground">Validando cupom…</p>
            )}
            {couponPreview && couponPreview.valid && couponPreview.code === couponNormalized && (
              <p className="mt-1 text-xs text-green-600 font-semibold">✓ Cupom aplicado: {couponPreview.label}</p>
            )}
            {couponPreview && !couponPreview.valid && !couponChecking && (
              <p className="mt-1 text-xs text-red-600">✗ {couponPreview.error}</p>
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

          <div>
            <h2 className="text-lg font-bold mb-3">Forma de pagamento</h2>
            <div className="space-y-2">
              <label className="flex items-start gap-3 rounded-lg border border-border p-4 cursor-pointer hover:bg-secondary/50">
                <input type="radio" name="pm" checked={paymentMethod === "pix"} onChange={() => {
                  setPaymentMethod("pix");
                  trackEvent("add_payment_info", {
                    currency: "BRL",
                    value: subtotal,
                    payment_type: "pix",
                  });
                }} className="mt-1" />
                <div className="flex-1">
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <QrCode className="h-4 w-4" /> Pix
                    <span className="ml-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">5% OFF</span>
                  </p>
                  <p className="text-xs text-muted-foreground">Aprovação instantânea — gera QR Code e código copia e cola. Ganhe 5% de desconto automático.</p>
                </div>
              </label>
              <label className="flex items-start gap-3 rounded-lg border border-border p-4 cursor-pointer hover:bg-secondary/50">
                <input type="radio" name="pm" checked={paymentMethod === "card"} onChange={() => {
                  setPaymentMethod("card");
                  trackEvent("add_payment_info", {
                    currency: "BRL",
                    value: subtotal,
                    payment_type: "credit_card",
                  });
                }} className="mt-1" />
                <div className="flex-1">
                  <p className="text-sm font-semibold flex items-center gap-2"><CreditCard className="h-4 w-4" /> Cartão de crédito</p>
                  <p className="text-xs text-muted-foreground">Visa, Master, Elo, Hipercard, Amex — em até 12x (via Mercado Pago).</p>
                </div>
              </label>
            </div>
          </div>

          {err && <p className="text-sm text-red-600">{err}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-foreground py-3 text-sm font-semibold uppercase tracking-wide text-background hover:bg-foreground/90 disabled:opacity-50"
          >
            {loading
              ? "Carregando..."
              : paymentMethod === "pix"
                ? `Pagar com Pix — R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                : `Pagar com cartão — R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
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
            {bundle.applied.map((b) => (
              <div key={b.id} className="flex justify-between text-green-600">
                <span className="truncate pr-2">
                  Combo {b.sets > 1 ? `${b.sets}× ` : ""}— {b.label.replace(/^Combo\s*/i, "")}
                </span>
                <span className="tabular-nums shrink-0">− R$ {(b.discountCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
              </div>
            ))}
            {couponDiscountCents > 0 && couponPreview && couponPreview.valid && (
              <div className="flex justify-between text-green-600">
                <span>
                  {couponPreview.kind === "amount"
                    ? `Vale-presente ${couponPreview.code}`
                    : `Desconto ${couponPreview.code} −${couponPreview.percent}%`}
                </span>
                <span className="tabular-nums">− R$ {discount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            {pixDiscount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Desconto Pix −{PIX_DISCOUNT_PERCENT}%</span>
                <span className="tabular-nums">− R$ {pixDiscount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Frete</span>
              <span className="tabular-nums">
                {shipping === "fixed"
                  ? selectedQuote
                    ? `R$ ${(selectedQuote.priceCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                    : "—"
                  : "A combinar"}
              </span>
            </div>
            <div className="flex justify-between text-base font-bold pt-2 border-t border-border">
              <span>Total</span>
              <span className="tabular-nums">R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
          <div className="mt-5 pt-5 border-t border-border">
            <TrustBadges variant="compact" />
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
          setTimeout(() => nav({ to: "/orders/$orderId", params: { orderId: pix.orderId } }), 1500);
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
    const ok = await copyToClipboard(pix.qrCode);
    if (ok) {
      setCopied(true);
      toast.success("Código Pix copiado!");
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error("Não foi possível copiar automaticamente. Toque e segure no código para copiar manualmente.");
    }
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
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium uppercase tracking-wide mb-1">
        {label}{required && <span className="text-red-600"> *</span>}
      </label>
      <input
        id={id}
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

declare global {
  interface Window {
    MercadoPago?: any;
  }
}

let mpSdkPromise: Promise<void> | null = null;
function loadMercadoPagoSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.MercadoPago) return Promise.resolve();
  if (mpSdkPromise) return mpSdkPromise;
  mpSdkPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://sdk.mercadopago.com/js/v2";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      mpSdkPromise = null;
      reject(new Error("Falha ao carregar SDK do Mercado Pago"));
    };
    document.head.appendChild(s);
  });
  return mpSdkPromise;
}

function CardScreen({
  card,
  onBack,
  onSuccess,
}: {
  card: CardState;
  onBack: () => void;
  onSuccess: (orderId: string) => void;
}) {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "in_process" | "approved" | "rejected">("idle");
  const [statusDetail, setStatusDetail] = useState<string | null>(null);
  const brickControllerRef = useRef<any>(null);
  const containerId = "mp-card-brick-container";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { publicKey } = await getMercadoPagoPublicKey({});
        if (cancelled) return;
        await loadMercadoPagoSdk();
        if (cancelled) return;

        const mp = new window.MercadoPago(publicKey, { locale: "pt-BR" });
        const bricksBuilder = mp.bricks();

        const settings = {
          initialization: {
            amount: card.totalCents / 100,
            payer: { email: card.payerEmail },
          },
          customization: {
            paymentMethods: { maxInstallments: 12 },
            visual: { style: { theme: "default" } },
          },
          callbacks: {
            onReady: () => {
              if (!cancelled) setLoading(false);
            },
            onError: (error: any) => {
              console.error("Brick error", error);
              if (!cancelled) setErr(error?.message ?? "Erro no formulário de cartão");
            },
            onSubmit: async (cardFormData: any) => {
              if (!session?.access_token) {
                setErr("Sessão expirada. Faça login novamente.");
                return;
              }
              setSubmitting(true);
              setErr(null);
              try {
                const result = await createCardOrder({
                  headers: { Authorization: `Bearer ${session.access_token}` },
                  data: {
                    items: card.itemsPayload,
                    shippingMethod: card.shipping,
                    shippingQuote: card.shippingQuote
                      ? {
                          serviceId: String(card.shippingQuote.serviceId),
                          serviceName: card.shippingQuote.serviceName,
                          company: card.shippingQuote.company,
                          priceCents: card.shippingQuote.priceCents,
                        }
                      : null,
                    address: card.address,
                    notes: card.notes,
                    couponCode: card.couponCode,
                    card: {
                      token: cardFormData.token,
                      paymentMethodId: cardFormData.payment_method_id,
                      issuerId: cardFormData.issuer_id ? String(cardFormData.issuer_id) : null,
                      installments: Number(cardFormData.installments) || 1,
                      payerEmail: cardFormData.payer?.email ?? card.payerEmail,
                      payerCpf:
                        cardFormData.payer?.identification?.number ?? card.payerCpf,
                    },
                  },
                });
                if (result.status === "approved") {
                  setStatus("approved");
                  toast.success("Pagamento aprovado!");
                  setTimeout(() => onSuccess(result.orderId), 1200);
                } else if (result.status === "in_process") {
                  setStatus("in_process");
                  setStatusDetail(result.statusDetail ?? null);
                  setTimeout(() => onSuccess(result.orderId), 1500);
                } else {
                  setStatus("rejected");
                  setStatusDetail(result.statusDetail ?? "Pagamento recusado");
                  setErr(result.statusDetail ?? "Pagamento recusado pelo emissor.");
                }
              } catch (e: any) {
                setErr(e?.message ?? "Erro ao processar pagamento");
              } finally {
                setSubmitting(false);
              }
            },
          },
        };

        const controller = await bricksBuilder.create(
          "cardPayment",
          containerId,
          settings,
        );
        if (cancelled) {
          controller?.unmount?.();
          return;
        }
        brickControllerRef.current = controller;
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Erro ao iniciar pagamento");
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      try {
        brickControllerRef.current?.unmount?.();
      } catch {}
    };
  }, [card, session, onSuccess]);

  const total = (card.totalCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-4">
        <div className="mx-auto max-w-2xl flex items-center justify-between">
          <Link to="/" className="text-sm font-bold uppercase tracking-widest">Sevii Colecionáveis</Link>
          <button onClick={onBack} className="text-xs text-muted-foreground hover:text-foreground">← Voltar</button>
        </div>
      </header>
      <main className="mx-auto max-w-xl px-4 py-8 space-y-6">
        <div className="text-center">
          <CreditCard className="h-8 w-8 mx-auto mb-2" />
          <h1 className="text-2xl font-bold">Pagamento com cartão</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Total: <span className="font-semibold text-foreground">R$ {total}</span>
          </p>
        </div>

        {status === "approved" && (
          <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-center">
            <p className="text-sm font-semibold text-green-800">✓ Pagamento aprovado! Redirecionando...</p>
          </div>
        )}
        {status === "in_process" && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-center">
            <p className="text-sm font-semibold text-amber-800">Pagamento em análise — você receberá uma confirmação em breve.</p>
            {statusDetail && <p className="text-xs text-amber-700 mt-1">{statusDetail}</p>}
          </div>
        )}

        {loading && (
          <p className="text-center text-sm text-muted-foreground">Carregando formulário seguro do Mercado Pago...</p>
        )}

        <div id={containerId} />

        {submitting && (
          <p className="text-center text-sm text-muted-foreground">Processando pagamento...</p>
        )}

        {err && status !== "approved" && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3">
            <p className="text-sm text-red-800">{err}</p>
          </div>
        )}
      </main>
    </div>
  );
}
