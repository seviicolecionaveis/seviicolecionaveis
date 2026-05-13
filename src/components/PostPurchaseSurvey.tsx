import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Star } from "lucide-react";
import { toast } from "sonner";

const SOURCES = ["Instagram", "TikTok", "Google", "Indicação de amigo", "Liga Pokémon", "Outro"];

interface Props {
  orderId: string;
}

export function PostPurchaseSurvey({ orderId }: Props) {
  const { user } = useAuth();
  const [exists, setExists] = useState<boolean | null>(null);
  const [howFound, setHowFound] = useState("");
  const [satisfaction, setSatisfaction] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("post_purchase_surveys")
      .select("id")
      .eq("order_id", orderId)
      .maybeSingle()
      .then(({ data }) => setExists(!!data));
  }, [user, orderId]);

  const submit = async (skipped: boolean) => {
    if (!user) return;
    if (!skipped && (!howFound || satisfaction === 0)) {
      toast.error("Selecione origem e satisfação");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("post_purchase_surveys").insert({
      order_id: orderId,
      user_id: user.id,
      how_found_us: skipped ? null : howFound,
      satisfaction: skipped ? null : satisfaction,
      comment: skipped ? null : (comment || null),
      skipped,
    });
    setSaving(false);
    if (error) {
      toast.error("Erro ao enviar");
      return;
    }
    setExists(true);
    if (!skipped) toast.success("Obrigado pelo feedback!");
  };

  if (exists !== false) return null;

  return (
    <section className="rounded-xl border-2 border-brand-gold/40 bg-card p-5 space-y-4">
      <div>
        <h2 className="text-lg font-bold">Conta pra gente, Trainer!</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Uma pesquisa rápida pra melhorar sua experiência.
        </p>
      </div>

      <div>
        <p className="text-sm font-semibold mb-2">Como você nos encontrou?</p>
        <div className="flex flex-wrap gap-2">
          {SOURCES.map((s) => (
            <button
              key={s}
              onClick={() => setHowFound(s)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                howFound === s
                  ? "bg-foreground text-background border-foreground"
                  : "border-border hover:bg-secondary"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold mb-2">Como foi sua experiência?</p>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setSatisfaction(n)}
              aria-label={`${n} estrelas`}
            >
              <Star
                className={`h-7 w-7 transition ${
                  n <= satisfaction
                    ? "fill-brand-gold text-brand-gold"
                    : "text-muted-foreground"
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-semibold block mb-1">Comentário (opcional)</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Conte o que achou..."
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => submit(false)}
          disabled={saving}
          className="rounded-md bg-foreground text-background px-5 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {saving ? "Enviando..." : "Enviar"}
        </button>
        <button
          onClick={() => submit(true)}
          disabled={saving}
          className="rounded-md border border-border px-5 py-2 text-sm"
        >
          Pular
        </button>
      </div>
    </section>
  );
}
