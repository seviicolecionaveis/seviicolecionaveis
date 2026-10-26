import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import { searchCustomersFn } from "@/lib/admin-customers.functions";
import { Search, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/admin/clientes/")({
  head: () => ({ meta: [{ title: "Clientes — Admin" }] }),
  component: AdminClientesList,
});

const PAGE_SIZE = 50;

function AdminClientesList() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const fetchCustomers = useServerFn(searchCustomersFn);

  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) window.location.href = "/auth";
    if (!authLoading && user && !isAdmin) window.location.href = "/";
  }, [authLoading, user, isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetchCustomers({ data: { q: activeQuery, limit: PAGE_SIZE, offset: page * PAGE_SIZE } });
        if (cancelled) return;
        setRows(res.rows ?? []);
        setTotal(res.total ?? 0);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Erro ao carregar clientes.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isAdmin, activeQuery, page, fetchCustomers]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    setActiveQuery(query.trim());
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (authLoading || !isAdmin) {
    return <div className="min-h-[60vh] grid place-items-center text-sm text-muted-foreground">Carregando...</div>;
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold">Clientes {total > 0 && <span className="text-muted-foreground text-base">({total})</span>}</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Consulte e corrija os dados cadastrados pelos clientes: nome, CPF, telefone, WhatsApp, nascimento, e-mail e endereços.
      </p>

      <form onSubmit={submitSearch} className="relative mb-6 max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nome, CPF, telefone, WhatsApp ou e-mail..."
          className="w-full rounded-lg border border-border bg-card py-2.5 pl-9 pr-4 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </form>

      {err && <p className="text-sm text-destructive mb-4">{err}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum cliente encontrado{activeQuery ? ` para “${activeQuery}”` : ""}.</p>
      ) : (
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {rows.map((c) => (
            <Link
              key={c.user_id}
              to="/admin/clientes/$id"
              params={{ id: c.user_id }}
              className="flex items-center gap-4 px-4 py-3 hover:bg-secondary/60 transition"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{c.full_name ?? "(sem nome)"}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {c.email ?? "—"}
                  {c.whatsapp ? ` · ${c.whatsapp}` : ""}
                </p>
              </div>
              <div className="hidden sm:block text-xs text-muted-foreground text-right shrink-0">
                <p>{c.cpf ? `CPF ${c.cpf}` : "sem CPF"}</p>
                <p>{c.orders_count ?? 0} {c.orders_count === 1 ? "pedido" : "pedidos"}</p>
              </div>
              <div className="hidden md:block text-xs text-muted-foreground text-right shrink-0 w-32">
                {new Date(c.created_at).toLocaleDateString("pt-BR")}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </Link>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-5 text-sm">
          <button
            type="button"
            disabled={page === 0 || loading}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="rounded-md border border-border px-3 py-1.5 disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-muted-foreground">Página {page + 1} de {totalPages}</span>
          <button
            type="button"
            disabled={(page + 1) * PAGE_SIZE >= total || loading}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-md border border-border px-3 py-1.5 disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      )}
    </main>
  );
}
