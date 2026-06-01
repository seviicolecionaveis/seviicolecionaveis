import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMyArteEmCardsCode } from "@/lib/arte-em-cards.functions";
import { copyToClipboard } from "@/lib/clipboard";
import { toast } from "sonner";
import { Copy, Check, Sparkles } from "lucide-react";

function formatExpiration(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

export function ArteEmCardsCard() {
  const fetchCode = useServerFn(getMyArteEmCardsCode);
  const [state, setState] = useState<
    | { loading: true }
    | { loading: false; hasCode: true; code: string; cycleEnd: string }
    | { loading: false; hasCode: false; nextCycleEnd: string }
    | { loading: false; error: string }
  >({ loading: true });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetchCode({});
        if (cancelled) return;
        if (r.hasCode) setState({ loading: false, hasCode: true, code: r.code, cycleEnd: r.cycleEnd });
        else setState({ loading: false, hasCode: false, nextCycleEnd: r.nextCycleEnd });
      } catch (e) {
        if (!cancelled) setState({ loading: false, error: e instanceof Error ? e.message : "Erro" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchCode]);

  if (state.loading || ("error" in state)) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">
          {state.loading ? "Carregando código…" : `Erro: ${state.error}`}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-foreground" />
        <h3 className="font-semibold">Código Arte em Cards</h3>
      </div>

      {state.hasCode ? (
        <>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md bg-secondary px-3 py-2 font-mono text-sm font-bold tracking-wider">
              {state.code}
            </code>
            <button
              onClick={async () => {
                const ok = await copyToClipboard(state.code);
                if (ok) {
                  setCopied(true);
                  toast.success("Código copiado!");
                  setTimeout(() => setCopied(false), 1800);
                }
              }}
              className="shrink-0 rounded-md border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary flex items-center gap-1"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
          <div className="text-xs space-y-1">
            <p>
              <span className="inline-block rounded-full bg-green-100 text-green-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                Ativo
              </span>
            </p>
            <p className="text-muted-foreground">
              Válido até <span className="font-semibold text-foreground">{formatExpiration(state.cycleEnd)}</span>
            </p>
            <p className="text-muted-foreground">
              Use este código no checkout, na modalidade <span className="font-semibold text-foreground">Retirada na Arte em Cards</span>,
              para isentar a taxa de R$ 5,00 em quantas compras quiser até esta data.
              O benefício vale sempre até a próxima sexta-feira às 11h59.
            </p>
          </div>
        </>
      ) : (
        <div className="text-xs text-muted-foreground space-y-2">
          <p>Você ainda não tem um código deste ciclo semanal.</p>
          <p>
            Faça uma compra escolhendo <span className="font-semibold text-foreground">Retirada na Arte em Cards</span> no checkout.
            Após pagar a taxa única de R$ 5,00, você receberá um código válido até{" "}
            <span className="font-semibold text-foreground">{formatExpiration(state.nextCycleEnd)}</span>{" "}
            para usar em quantas compras quiser nesta modalidade durante o ciclo.
          </p>
        </div>
      )}
    </div>
  );
}
