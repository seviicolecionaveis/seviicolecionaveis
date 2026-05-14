import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/unsubscribe")({
  head: () => ({ meta: [{ title: "Cancelar inscrição — Sevii Colecionáveis" }] }),
  component: UnsubscribePage,
});

function UnsubscribePage() {
  const [state, setState] = useState<"checking" | "valid" | "already" | "invalid" | "submitting" | "done" | "error">("checking");
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    setToken(t);
    if (!t) {
      setState("invalid");
      return;
    }
    fetch(`/email/unsubscribe?token=${encodeURIComponent(t)}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) return setState("invalid");
        if (data.valid === false && data.reason === "already_unsubscribed") return setState("already");
        if (data.valid === true) return setState("valid");
        setState("invalid");
      })
      .catch(() => setState("error"));
  }, []);

  const confirm = async () => {
    if (!token) return;
    setState("submitting");
    try {
      const r = await fetch("/email/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await r.json().catch(() => ({}));
      if (data.success) setState("done");
      else if (data.reason === "already_unsubscribed") setState("already");
      else setState("error");
    } catch {
      setState("error");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center border border-border rounded-xl p-8 bg-card">
        <h1 className="text-2xl font-bold mb-3">Cancelar inscrição</h1>

        {state === "checking" && <p className="text-sm text-muted-foreground">Verificando o link...</p>}

        {state === "valid" && (
          <>
            <p className="text-sm text-muted-foreground mb-6">
              Você está prestes a parar de receber emails da Sevii Colecionáveis. Tem certeza?
            </p>
            <button
              onClick={confirm}
              className="rounded-md bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:bg-primary/90"
            >
              Confirmar cancelamento
            </button>
          </>
        )}

        {state === "submitting" && <p className="text-sm text-muted-foreground">Processando...</p>}

        {state === "done" && (
          <p className="text-sm text-foreground">
            Pronto! Você não receberá mais emails da gente. 💛
          </p>
        )}

        {state === "already" && (
          <p className="text-sm text-muted-foreground">Esse email já estava cancelado.</p>
        )}

        {state === "invalid" && (
          <p className="text-sm text-destructive">Link inválido ou expirado.</p>
        )}

        {state === "error" && (
          <p className="text-sm text-destructive">Ocorreu um erro. Tente novamente em alguns instantes.</p>
        )}
      </div>
    </div>
  );
}
