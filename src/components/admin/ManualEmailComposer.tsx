import { useState } from "react";
import { toast } from "sonner";
import {
  previewAdminBroadcast,
  sendAdminBroadcast,
} from "@/lib/admin-email-compose.functions";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseRecipients(raw: string) {
  const parts = raw
    .split(/[\s,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const p of parts) {
    if (seen.has(p)) continue;
    seen.add(p);
    if (EMAIL_RE.test(p)) valid.push(p);
    else invalid.push(p);
  }
  return { valid, invalid };
}

interface Props {
  onSent?: () => void;
}

export default function ManualEmailComposer({ onSent }: Props) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [heading, setHeading] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [body, setBody] = useState(
    "Olá!\n\nEscreva sua mensagem aqui. Separe parágrafos com uma linha em branco.\n\nUse **negrito** e [links](https://www.seviicolecionaveis.com.br) quando quiser.",
  );
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [recipientsRaw, setRecipientsRaw] = useState("");
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  const { valid, invalid } = parseRecipients(recipientsRaw);

  const buildPayload = () => ({
    subject: subject.trim(),
    heading: heading.trim() || null,
    previewText: previewText.trim() || null,
    body,
    cta:
      ctaLabel.trim() && ctaUrl.trim()
        ? { label: ctaLabel.trim(), url: ctaUrl.trim() }
        : null,
    recipients: valid,
  });

  const handlePreview = async () => {
    if (!subject.trim() || !body.trim()) {
      toast.error("Preencha assunto e corpo antes de pré-visualizar.");
      return;
    }
    setPreviewing(true);
    try {
      const res = await previewAdminBroadcast({ data: buildPayload() });
      setPreviewHtml(res.html);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar pré-visualização");
    } finally {
      setPreviewing(false);
    }
  };

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      toast.error("Preencha assunto e corpo.");
      return;
    }
    if (valid.length === 0) {
      toast.error("Adicione ao menos um destinatário válido.");
      return;
    }
    const msg = `Enviar "${subject.trim()}" para ${valid.length} destinatário(s)?`;
    if (!window.confirm(msg)) return;
    setSending(true);
    try {
      const res = await sendAdminBroadcast({ data: buildPayload() });
      toast.success(
        `Enfileirado: ${res.enqueued} enviado(s), ${res.skipped} pulado(s) de ${res.total}.`,
      );
      onSent?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao enviar");
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
      >
        <div>
          <p className="text-sm font-semibold">Compor e-mail manual</p>
          <p className="text-xs text-muted-foreground">
            Envie um comunicado personalizado (identidade visual Sevii) para uma lista de clientes.
          </p>
        </div>
        <span className="text-xs text-muted-foreground">{open ? "Recolher ▲" : "Expandir ▼"}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-xs">
              <span className="mb-1 block font-semibold">Assunto *</span>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={200}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                placeholder="Ex: Nova coleção chegou!"
              />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block font-semibold">Título dentro do e-mail (opcional)</span>
              <input
                value={heading}
                onChange={(e) => setHeading(e.target.value)}
                maxLength={200}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                placeholder="Ex: Novidades da semana"
              />
            </label>
          </div>

          <label className="block text-xs">
            <span className="mb-1 block font-semibold">Texto de prévia (opcional)</span>
            <input
              value={previewText}
              onChange={(e) => setPreviewText(e.target.value)}
              maxLength={200}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="Aparece como resumo na caixa de entrada"
            />
          </label>

          <label className="block text-xs">
            <span className="mb-1 block font-semibold">
              Corpo * <span className="font-normal text-muted-foreground">— parágrafos separados por linha em branco. Use **negrito**, [texto](https://...) e ## Subtítulo.</span>
            </span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              maxLength={10000}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
            />
            <span className="mt-1 block text-right text-[10px] text-muted-foreground">
              {body.length}/10000
            </span>
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-xs">
              <span className="mb-1 block font-semibold">Botão CTA — texto (opcional)</span>
              <input
                value={ctaLabel}
                onChange={(e) => setCtaLabel(e.target.value)}
                maxLength={60}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                placeholder="Ex: Falar no WhatsApp"
              />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block font-semibold">Botão CTA — URL (opcional)</span>
              <input
                value={ctaUrl}
                onChange={(e) => setCtaUrl(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                placeholder="https://wa.me/5579981509552"
              />
            </label>
          </div>

          <label className="block text-xs">
            <span className="mb-1 block font-semibold">
              Destinatários * <span className="font-normal text-muted-foreground">— um por linha ou separados por vírgula/;</span>
            </span>
            <textarea
              value={recipientsRaw}
              onChange={(e) => setRecipientsRaw(e.target.value)}
              rows={5}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
              placeholder="cliente1@email.com&#10;cliente2@email.com"
            />
            <span className="mt-1 block text-[11px] text-muted-foreground">
              {valid.length} válido(s){invalid.length ? `, ${invalid.length} inválido(s): ${invalid.slice(0, 3).join(", ")}${invalid.length > 3 ? "..." : ""}` : ""}
              {valid.length > 200 ? " — máximo 200 por envio." : ""}
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handlePreview}
              disabled={previewing}
              className="rounded-md border border-border px-4 py-2 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
            >
              {previewing ? "Gerando..." : "Pré-visualizar"}
            </button>
            <button
              onClick={handleSend}
              disabled={sending || valid.length === 0 || valid.length > 200}
              className="rounded-md bg-foreground px-4 py-2 text-xs font-semibold text-background hover:opacity-90 disabled:opacity-50"
            >
              {sending
                ? "Enviando..."
                : `Enviar para ${valid.length} destinatário(s)`}
            </button>
          </div>

          {previewHtml && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setPreviewHtml(null)}>
              <div className="flex h-[90vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between border-b p-3">
                  <p className="text-sm font-semibold">Pré-visualização</p>
                  <button onClick={() => setPreviewHtml(null)} className="text-xs text-muted-foreground hover:underline">Fechar ✕</button>
                </div>
                <iframe title="Preview" srcDoc={previewHtml} className="flex-1 w-full rounded-b-xl" />
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
