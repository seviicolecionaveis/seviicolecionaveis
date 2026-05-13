import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type PendingOrder = {
  id: string;
  recipient_name: string | null;
  total_cents: number;
  updated_at: string;
};

export function AdminCancellationBell() {
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const nav = useNavigate();

  const load = async () => {
    const { data } = await supabase
      .from("orders")
      .select("id, recipient_name, total_cents, updated_at")
      .eq("status", "cancellation_requested")
      .order("updated_at", { ascending: false });
    setOrders((data ?? []) as PendingOrder[]);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("admin-cancellation-bell")
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

  const goTo = (orderId: string) => {
    setOpen(false);
    nav({ to: "/admin", search: { focus: orderId } as any });
  };

  const count = orders.length;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-secondary"
        title="Solicitações de cancelamento"
        aria-label="Solicitações de cancelamento"
      >
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold grid place-items-center">
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-xl border border-border bg-card shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-bold uppercase tracking-wider">
              Cancelamentos pendentes ({count})
            </p>
          </div>
          {count === 0 ? (
            <p className="px-4 py-6 text-xs text-muted-foreground italic">
              Nenhuma solicitação pendente.
            </p>
          ) : (
            <ul className="max-h-80 overflow-auto divide-y divide-border">
              {orders.map((o) => (
                <li key={o.id}>
                  <button
                    onClick={() => goTo(o.id)}
                    className="w-full text-left px-4 py-3 hover:bg-secondary"
                  >
                    <p className="text-sm font-semibold truncate">
                      {o.recipient_name ?? "Cliente"}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">
                      #{o.id.slice(0, 8)} · R$ {(o.total_cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(o.updated_at).toLocaleString("pt-BR")}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
