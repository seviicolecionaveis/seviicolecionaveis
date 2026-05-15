import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type OrderRow = {
  id: string;
  recipient_name: string | null;
  total_cents: number;
  status: string;
  created_at: string;
  updated_at: string;
};

const LAST_SEEN_KEY = "admin:notifications:lastSeenAt";

export function AdminCancellationBell() {
  const [recent, setRecent] = useState<OrderRow[]>([]);
  const [cancellations, setCancellations] = useState<OrderRow[]>([]);
  const [open, setOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState<string>(() => {
    if (typeof window === "undefined") return new Date(0).toISOString();
    return localStorage.getItem(LAST_SEEN_KEY) ?? new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  });
  const ref = useRef<HTMLDivElement>(null);
  const nav = useNavigate();

  const load = async () => {
    const sinceIso = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const [{ data: recentData }, { data: cancelData }] = await Promise.all([
      supabase
        .from("orders")
        .select("id, recipient_name, total_cents, status, created_at, updated_at")
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("orders")
        .select("id, recipient_name, total_cents, status, created_at, updated_at")
        .eq("status", "cancellation_requested")
        .order("updated_at", { ascending: false }),
    ]);
    setRecent((recentData ?? []) as OrderRow[]);
    setCancellations((cancelData ?? []) as OrderRow[]);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("admin-notifications-bell")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => { load(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const visibleOrders = useMemo(
    () => recent.filter((o) => o.status !== "cancelled" && o.status !== "cancellation_requested"),
    [recent],
  );
  const unseenCount = useMemo(
    () => visibleOrders.filter((o) => o.created_at > lastSeen).length,
    [visibleOrders, lastSeen],
  );

  const cancelCount = cancellations.length;
  const totalBadge = cancelCount + unseenCount;

  const handleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      const now = new Date().toISOString();
      localStorage.setItem(LAST_SEEN_KEY, now);
      setLastSeen(now);
    }
  };

  const goTo = (orderId: string) => {
    setOpen(false);
    nav({ to: "/admin", search: { focus: orderId } as any });
  };

  const fmtBRL = (cents: number) =>
    `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleOpen}
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-secondary"
        title="Notificações"
        aria-label="Notificações"
      >
        <Bell className="h-4 w-4" />
        {totalBadge > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold grid place-items-center">
            {totalBadge}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-xl border border-border bg-card shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-bold uppercase tracking-wider">Notificações</p>
          </div>

          <div className="max-h-96 overflow-auto">
            <section>
              <div className="px-4 py-2 bg-muted/40 border-b border-border">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Cancelamentos pendentes ({cancelCount})
                </p>
              </div>
              {cancelCount === 0 ? (
                <p className="px-4 py-3 text-xs text-muted-foreground italic">
                  Nenhuma solicitação pendente.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {cancellations.map((o) => (
                    <li key={o.id}>
                      <button
                        onClick={() => goTo(o.id)}
                        className="w-full text-left px-4 py-3 hover:bg-secondary"
                      >
                        <p className="text-sm font-semibold truncate">
                          {o.recipient_name ?? "Cliente"}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono">
                          #{o.id.slice(0, 8)} · {fmtBRL(o.total_cents)}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {new Date(o.updated_at).toLocaleString("pt-BR")}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <div className="px-4 py-2 bg-muted/40 border-y border-border">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Novos pedidos ({newCount})
                </p>
              </div>
              {newCount === 0 ? (
                <p className="px-4 py-3 text-xs text-muted-foreground italic">
                  Nenhum pedido novo desde a última visita.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {newOrders.map((o) => (
                    <li key={o.id}>
                      <button
                        onClick={() => goTo(o.id)}
                        className="w-full text-left px-4 py-3 hover:bg-secondary"
                      >
                        <p className="text-sm font-semibold truncate">
                          {o.recipient_name ?? "Cliente"}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono">
                          #{o.id.slice(0, 8)} · {fmtBRL(o.total_cents)} · {o.status}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {new Date(o.created_at).toLocaleString("pt-BR")}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
