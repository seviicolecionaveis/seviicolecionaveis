import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, MapPin, Pencil, Plus, Trash2, Upload, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  createPublicEvent,
  deletePublicEvent,
  listAllPublicEvents,
  updatePublicEvent,
} from "@/lib/public-events.functions";
import {
  EVENT_DISPLAY_STATUS_LABELS,
  eventDisplayStatus,
  formatEventDate,
  formatTimeRange,
  todayYmd,
  type PublicEvent,
} from "@/lib/public-events";

export const Route = createFileRoute("/admin/eventos-loja")({
  head: () => ({
    meta: [
      { title: "Eventos da loja — Admin Sevii" },
      { name: "description", content: "Gerencie os eventos públicos da Sevii Colecionáveis." },
      { property: "og:title", content: "Eventos da loja — Admin Sevii" },
      { property: "og:description", content: "Gerencie os eventos públicos da Sevii Colecionáveis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminEventosLojaPage,
});

type EventWithCount = PublicEvent & { confirmed_count: number };

type FormState = {
  title: string;
  cover_image: string;
  short_description: string;
  description: string;
  event_date: string;
  start_time: string;
  end_time: string;
  location_name: string;
  address: string;
  capacity: string;
  registration_status: "open" | "closed";
  publication_status: "draft" | "published";
  additional_info: string;
};

const EMPTY_FORM: FormState = {
  title: "",
  cover_image: "",
  short_description: "",
  description: "",
  event_date: "",
  start_time: "",
  end_time: "",
  location_name: "",
  address: "",
  capacity: "",
  registration_status: "open",
  publication_status: "draft",
  additional_info: "",
};

function eventToForm(e: PublicEvent): FormState {
  return {
    title: e.title,
    cover_image: e.cover_image ?? "",
    short_description: e.short_description ?? "",
    description: e.description ?? "",
    event_date: e.event_date,
    start_time: e.start_time,
    end_time: e.end_time,
    location_name: e.location_name ?? "",
    address: e.address ?? "",
    capacity: e.capacity != null ? String(e.capacity) : "",
    registration_status: e.registration_status,
    publication_status: e.publication_status,
    additional_info: e.additional_info ?? "",
  };
}

function AdminEventosLojaPage() {
  const { isAdmin } = useAuth();
  const [events, setEvents] = useState<EventWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EventWithCount | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      setEvents((await listAllPublicEvents()) as EventWithCount[]);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao carregar eventos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (e: EventWithCount) => {
    setEditing(e);
    setForm(eventToForm(e));
    setFormOpen(true);
  };

  const onUploadCover = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `eventos/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("card-images")
        .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("card-images").getPublicUrl(path);
      setForm((f) => ({ ...f, cover_image: pub.publicUrl }));
      toast.success("Imagem enviada.");
    } catch (e: any) {
      toast.error(`Erro no upload: ${e.message}`);
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!form.title.trim()) return toast.error("Informe o nome do evento.");
    if (!form.event_date) return toast.error("Informe a data do evento.");
    if (!form.start_time || !form.end_time) return toast.error("Informe os horários de início e término.");
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      cover_image: form.cover_image.trim() || null,
      short_description: form.short_description.trim() || null,
      description: form.description.trim() || null,
      event_date: form.event_date,
      start_time: form.start_time,
      end_time: form.end_time,
      location_name: form.location_name.trim() || null,
      address: form.address.trim() || null,
      capacity: form.capacity.trim() ? Number(form.capacity) : null,
      registration_status: form.registration_status,
      publication_status: form.publication_status,
      additional_info: form.additional_info.trim() || null,
    };
    try {
      if (editing) {
        await updatePublicEvent({ data: { id: editing.id, data: payload } });
        toast.success("Evento atualizado.");
      } else {
        await createPublicEvent({ data: payload });
        toast.success("Evento criado.");
      }
      setFormOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar evento.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (e: EventWithCount) => {
    const msg =
      e.confirmed_count > 0
        ? `Excluir "${e.title}"? Existem ${e.confirmed_count} presenças confirmadas que também serão removidas.`
        : `Excluir "${e.title}"?`;
    if (!window.confirm(msg)) return;
    try {
      await deletePublicEvent({ data: { id: e.id } });
      toast.success("Evento excluído.");
      await load();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao excluir evento.");
    }
  };

  const togglePublication = async (e: EventWithCount) => {
    try {
      await updatePublicEvent({
        data: {
          id: e.id,
          data: {
            ...eventToForm(e),
            capacity: e.capacity,
            cover_image: e.cover_image,
            short_description: e.short_description,
            description: e.description,
            location_name: e.location_name,
            address: e.address,
            additional_info: e.additional_info,
            publication_status: e.publication_status === "published" ? "draft" : "published",
          },
        },
      });
      toast.success(e.publication_status === "published" ? "Evento despublicado." : "Evento publicado.");
      await load();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao alterar publicação.");
    }
  };

  const toggleRegistration = async (e: EventWithCount) => {
    try {
      await updatePublicEvent({
        data: {
          id: e.id,
          data: {
            ...eventToForm(e),
            capacity: e.capacity,
            cover_image: e.cover_image,
            short_description: e.short_description,
            description: e.description,
            location_name: e.location_name,
            address: e.address,
            additional_info: e.additional_info,
            registration_status: e.registration_status === "open" ? "closed" : "open",
          },
        },
      });
      toast.success(e.registration_status === "open" ? "Inscrições encerradas." : "Inscrições abertas.");
      await load();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao alterar inscrições.");
    }
  };

  const inputCls =
    "w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";
  const labelCls = "mb-1 block text-xs font-semibold text-muted-foreground";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Eventos da loja</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Eventos públicos com confirmação de presença pelo site. A retirada em eventos continua em{" "}
            <Link to="/admin/eventos" className="underline">Eventos (retirada)</Link>.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Novo evento
        </button>
      </div>

      {loading ? (
        <p className="mt-8 text-sm text-muted-foreground">Carregando...</p>
      ) : events.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-border p-10 text-center">
          <CalendarDays className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhum evento cadastrado ainda.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {events.map((e) => {
            const status = eventDisplayStatus(e, e.confirmed_count, todayYmd());
            return (
              <div
                key={e.id}
                className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-4"
              >
                <div className="h-16 w-24 shrink-0 overflow-hidden rounded-md bg-secondary">
                  {e.cover_image && (
                    <img src={e.cover_image} alt={e.title} className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{e.title}</p>
                    {e.publication_status === "draft" ? (
                      <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                        Rascunho
                      </span>
                    ) : (
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-800">
                        Publicado
                      </span>
                    )}
                    <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-bold uppercase text-foreground">
                      {EVENT_DISPLAY_STATUS_LABELS[status]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatEventDate(e.event_date)} · {formatTimeRange(e.start_time, e.end_time)}
                    {e.location_name ? ` · ${e.location_name}` : ""}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    {e.confirmed_count} confirmado{e.confirmed_count === 1 ? "" : "s"}
                    {e.capacity != null ? ` · limite de ${e.capacity}` : " · sem limite de vagas"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to="/admin/eventos-loja/$eventId"
                    params={{ eventId: e.id }}
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
                  >
                    Participantes
                  </Link>
                  <button
                    type="button"
                    onClick={() => toggleRegistration(e)}
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
                  >
                    {e.registration_status === "open" ? "Encerrar inscrições" : "Abrir inscrições"}
                  </button>
                  <button
                    type="button"
                    onClick={() => togglePublication(e)}
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
                  >
                    {e.publication_status === "published" ? "Despublicar" : "Publicar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(e)}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
                  >
                    <Pencil className="h-3 w-3" /> Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(e)}
                    className="inline-flex items-center gap-1 rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-3 w-3" /> Excluir
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-8 w-full max-w-2xl rounded-xl border border-border bg-card p-6 shadow-xl">
            <h2 className="text-lg font-bold">{editing ? "Editar evento" : "Novo evento"}</h2>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelCls}>Nome do evento *</label>
                <input
                  className={inputCls}
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Ex.: Lançamento da coleção Reinado Delta"
                />
              </div>

              <div className="sm:col-span-2">
                <label className={labelCls}>Imagem de capa</label>
                <div className="flex items-center gap-3">
                  {form.cover_image && (
                    <img src={form.cover_image} alt="Capa" className="h-16 w-28 rounded-md object-cover" />
                  )}
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {uploading ? "Enviando..." : form.cover_image ? "Trocar imagem" : "Enviar imagem"}
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onUploadCover(file);
                      e.target.value = "";
                    }}
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className={labelCls}>Descrição resumida</label>
                <input
                  className={inputCls}
                  value={form.short_description}
                  onChange={(e) => setForm((f) => ({ ...f, short_description: e.target.value }))}
                  placeholder="Aparece no card da lista de eventos"
                  maxLength={300}
                />
              </div>

              <div className="sm:col-span-2">
                <label className={labelCls}>Descrição completa</label>
                <textarea
                  className={`${inputCls} min-h-28`}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Todas as informações do evento, programação etc."
                />
              </div>

              <div>
                <label className={labelCls}>Data do evento *</label>
                <input
                  type="date"
                  className={inputCls}
                  value={form.event_date}
                  onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Início *</label>
                  <input
                    type="time"
                    className={inputCls}
                    value={form.start_time}
                    onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={labelCls}>Término *</label>
                  <input
                    type="time"
                    className={inputCls}
                    value={form.end_time}
                    onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Nome do local</label>
                <input
                  className={inputCls}
                  value={form.location_name}
                  onChange={(e) => setForm((f) => ({ ...f, location_name: e.target.value }))}
                  placeholder="Ex.: Shopping Jardins"
                />
              </div>
              <div>
                <label className={labelCls}>Limite de participantes</label>
                <input
                  type="number"
                  min={1}
                  className={inputCls}
                  value={form.capacity}
                  onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
                  placeholder="Deixe vazio para ilimitado"
                />
              </div>

              <div className="sm:col-span-2">
                <label className={labelCls}>Endereço completo</label>
                <input
                  className={inputCls}
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Rua, número, bairro, cidade"
                />
              </div>

              <div>
                <label className={labelCls}>Status do evento</label>
                <select
                  className={inputCls}
                  value={form.publication_status}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, publication_status: e.target.value as "draft" | "published" }))
                  }
                >
                  <option value="draft">Rascunho (não aparece no site)</option>
                  <option value="published">Publicado</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Status das inscrições</label>
                <select
                  className={inputCls}
                  value={form.registration_status}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, registration_status: e.target.value as "open" | "closed" }))
                  }
                >
                  <option value="open">Abertas</option>
                  <option value="closed">Encerradas</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className={labelCls}>Informações adicionais</label>
                <textarea
                  className={`${inputCls} min-h-20`}
                  value={form.additional_info}
                  onChange={(e) => setForm((f) => ({ ...f, additional_info: e.target.value }))}
                  placeholder="Estacionamento, o que levar, regras etc."
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded-md border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Salvando..." : editing ? "Salvar alterações" : "Criar evento"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
