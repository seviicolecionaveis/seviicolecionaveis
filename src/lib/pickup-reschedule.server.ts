import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendTransactionalEmailSafe } from "@/lib/email/send.server";
import { formatSchedule, shouldReopenPickup, validateSchedule } from "@/lib/scheduling";
import { sendScheduleConfirmations } from "@/lib/schedule-confirmation.server";
import { effectiveFulfillment, canGroupOrder } from "./fulfillment-groups";

type HistoryEntry = { scheduled_at: string; kind: string; outcome: string; recorded_at: string };

/** Reabre retiradas não concluídas até 14h do dia seguinte. Não mexe em pilhas (prazo de 30 dias intacto). */
export async function reopenExpiredPickups(now = new Date()) {
  const db = supabaseAdmin as any;
  const { data, error } = await db
    .from("orders")
    .select("*")
    .not("status", "in", '("delivered","cancelled","shipped","refunded")');
  if (error) throw error;
  let reopened = 0;
  const handled = new Set<string>();
  for (const raw of data ?? []) {
    const o = effectiveFulfillment(raw);
    if (o.schedule_kind !== "pickup" || o.reschedule_required || !o.scheduled_at) continue;
    if (!shouldReopenPickup(o, now)) continue;
    if (o.fulfillment_group_id) {
      if (handled.has(o.fulfillment_group_id)) continue;
      handled.add(o.fulfillment_group_id);
      const { error: groupError } = await db.rpc("fulfillment_group_action", { p_order: o.id, p_action: "reopen" });
      if (groupError) throw new Error(groupError.message);
      const { notifyGroup } = await import("./fulfillment-groups.server");
      await notifyGroup(o.fulfillment_group_id, `reopen:${o.scheduled_at}`, "auto", true, "Não compareceu / não concluído — reagendamento necessário");
      reopened++;
      continue;
    }
    const history: HistoryEntry[] = Array.isArray(o.schedule_history) ? o.schedule_history : [];
    history.push({ scheduled_at: o.scheduled_at, kind: "pickup", outcome: "Não compareceu / não concluído", recorded_at: now.toISOString() });
    const { data: upd } = await db
      .from("orders")
      .update({ reschedule_required: true, schedule_reopened_at: now.toISOString(), schedule_history: history })
      .eq("id", o.id)
      .eq("reschedule_required", false)
      .select("id");
    if (!upd?.length) continue;
    reopened++;
    await autoReopenAlert(o, "Retirada em mãos", null);
    if (o.email) {
      await sendTransactionalEmailSafe({
        templateName: "pickup-reopened",
        recipientEmail: o.email,
        idempotencyKey: `pickup-reopened-${o.id}-${o.scheduled_at}`,
        templateData: { recipientName: o.recipient_name ?? undefined, orderId: o.id, previous: formatSchedule("pickup", o.scheduled_at) },
      }).catch((e: unknown) => console.error("[pickup-reopen] email", e));
    }
  }
  return { reopened };
}

/** Reabre retiradas em eventos não concluídas até 10h do dia seguinte ao fim do evento. */
export async function reopenExpiredEventPickups(now = new Date()) {
  const db = supabaseAdmin as any;
  const { data, error } = await db
    .from("orders")
    .select("*")
    .not("status", "in", '("delivered","cancelled","shipped","refunded")');
  if (error) throw error;
  const effective = (data ?? []).map(effectiveFulfillment).filter((o: any) => o.schedule_kind === "event" && !o.reschedule_required && o.event_id && o.scheduled_at);
  const eventIds = [...new Set(effective.map((o: any) => o.event_id))];
  const { data: evs } = eventIds.length
    ? await db.from("events").select("*").in("id", eventIds)
    : { data: [] };
  const { shouldReopenEventOrder, formatYmd, eventTimeRangeLabel } = await import("@/lib/events");
  const eventsById = new Map(
    (evs ?? []).map((e: any) => [
      e.id,
      {
        id: e.id,
        name: e.name,
        description: e.description ?? null,
        start_date: e.start_date,
        end_date: e.end_date,
        start_time: String(e.start_time).slice(0, 5),
        end_time: String(e.end_time).slice(0, 5),
        per_day_times: e.per_day_times ?? null,
        active: e.active,
      },
    ]),
  );
  let reopened = 0;
  const handled = new Set<string>();
  for (const o of effective) {
    const ev = eventsById.get(o.event_id);
    if (!ev || !shouldReopenEventOrder(o, ev as any, now)) continue;
    if (o.fulfillment_group_id) {
      if (handled.has(o.fulfillment_group_id)) continue;
      handled.add(o.fulfillment_group_id);
      const { error: groupError } = await db.rpc("fulfillment_group_action", { p_order: o.id, p_action: "reopen" });
      if (groupError) throw new Error(groupError.message);
      const { notifyGroup } = await import("./fulfillment-groups.server");
      await notifyGroup(o.fulfillment_group_id, `reopen:${o.scheduled_at}`, "auto", true, "Não compareceu / não concluído — reagendamento necessário");
      reopened++;
      continue;
    }
    const history: HistoryEntry[] = Array.isArray(o.schedule_history) ? o.schedule_history : [];
    history.push({ scheduled_at: o.scheduled_at, kind: "event", outcome: "Não compareceu / não concluído", recorded_at: now.toISOString() });
    const { data: upd } = await db
      .from("orders")
      .update({ reschedule_required: true, schedule_reopened_at: now.toISOString(), schedule_history: history })
      .eq("id", o.id)
      .eq("reschedule_required", false)
      .select("id");
    if (!upd?.length) continue;
    reopened++;
    await autoReopenAlert(o, "Retirada em eventos", (ev as any).name ?? null);
    if (o.email) {
      const when = `${formatYmd((ev as any).start_date)}, ${eventTimeRangeLabel(ev as any)}`;
      await sendTransactionalEmailSafe({
        templateName: "pickup-reopened",
        recipientEmail: o.email,
        idempotencyKey: `event-reopened-${o.id}-${o.scheduled_at}`,
        templateData: {
          recipientName: o.recipient_name ?? undefined,
          orderId: o.id,
          previous: `${(ev as any).name} — ${when}`,
        },
      }).catch((e: unknown) => console.error("[event-reopen] email", e));
    }
  }
  return { reopened };
}

/** Cliente escolhe novo horário de retirada (Regra 1 revalidada no servidor). */
export async function reschedulePickup(
  userId: string,
  orderId: string,
  at: string,
  opts?: { kind?: "pickup" | "event"; eventId?: string | null },
) {
  const db = supabaseAdmin as any;
  const { data: o } = await db.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!o || o.user_id !== userId) throw new Error("Pedido não encontrado.");
  if (o.fulfillment_group_id) {
    const effective = effectiveFulfillment(o);
    if (!effective.reschedule_required) throw new Error("Este pedido não precisa de reagendamento.");
    const { data: members } = await db.from("orders").select("*").eq("fulfillment_group_id", o.fulfillment_group_id);
    const ids = (members ?? []).filter(canGroupOrder).map((x: any) => x.id);
    const { applyGroup } = await import("./fulfillment-groups.server");
    await applyGroup(ids, { ...o.fulfillment_data, scheduled_at: at, schedule_kind: opts?.kind ?? "pickup", event_id: opts?.eventId ?? null, reschedule_required: false }, `reschedule:${o.fulfillment_group_id}:${at}`, { existingId: o.fulfillment_group_id, serviceId: o.fulfillment_service_order_id });
    return { scheduled_at: at };
  }
  if (!["pickup", "event"].includes(o.schedule_kind ?? "") || !o.reschedule_required)
    throw new Error("Este pedido não precisa de reagendamento.");
  const kind = opts?.kind ?? "pickup";
  let notes = o.notes;
  let eventId: string | null = null;
  if (kind === "event") {
    if (!opts?.eventId) throw new Error("Escolha o evento da retirada.");
    const { data: ev } = await db.from("events").select("*").eq("id", opts.eventId).maybeSingle();
    if (!ev) throw new Error("Evento não encontrado.");
    const { validateEventSchedule, ymdOfIso } = await import("@/lib/events");
    const { localParts } = await import("@/lib/scheduling");
    const eventErr = validateEventSchedule(
      {
        id: ev.id,
        name: ev.name,
        description: ev.description ?? null,
        start_date: ev.start_date,
        end_date: ev.end_date,
        start_time: String(ev.start_time).slice(0, 5),
        end_time: String(ev.end_time).slice(0, 5),
        per_day_times: ev.per_day_times ?? null,
        active: ev.active,
      },
      ymdOfIso(at),
      localParts(at).time,
    );
    if (eventErr) throw new Error(eventErr);
    eventId = ev.id;
    notes = `Retirada em eventos: ${ev.name} — ${formatSchedule("pickup", at)}.`;
  } else {
    const err = validateSchedule("pickup", at);
    if (err) throw new Error(err);
    notes = typeof o.notes === "string"
      ? o.notes.replace(/(Retirada em mãos: .*) — [^\n]*?\./, `$1 — ${formatSchedule("pickup", at)}.`)
      : o.notes;
    if (o.schedule_kind === "event") {
      notes = `Retirada em mãos — ${formatSchedule("pickup", at)}.`;
    }
  }
  const { data: upd, error } = await db
    .from("orders")
    .update({ scheduled_at: at, reschedule_required: false, notes, schedule_kind: kind, event_id: eventId })
    .eq("id", orderId)
    .eq("reschedule_required", true)
    .select("*")
    .maybeSingle();
  if (error || !upd) throw new Error("Não foi possível reagendar. Tente novamente.");
  const before = o.scheduled_at ? `${o.schedule_kind === "event" ? "Retirada em eventos" : "Retirada em mãos"} — ${formatSchedule("pickup", o.scheduled_at)} (não compareceu)` : null;
  await sendScheduleConfirmations(upd, `-${at}`, { action: "changed", source: "customer", before }).catch((e) => console.error("[reschedule] email", e));
  return { scheduled_at: at };
}

/** Reabertura automática: registra alerta no admin (o cliente já recebe o e-mail de reabertura). */
async function autoReopenAlert(o: any, label: string, eventName: string | null) {
  try {
    const { notifyFulfillmentChange } = await import("@/lib/fulfillment-alerts.server");
    await notifyFulfillmentChange({
      targetType: "order", targetId: o.id, code: `#${String(o.id).slice(0, 8).toUpperCase()}`,
      action: "cancelled", source: "auto", modality: o.schedule_kind === "event" ? "event" : "pickup",
      customerName: o.recipient_name, customerEmail: o.email, scheduledAt: o.scheduled_at,
      when: formatSchedule("pickup", o.scheduled_at), eventId: o.event_id ?? null, eventName,
      before: `${label} — ${formatSchedule("pickup", o.scheduled_at)} (não compareceu, retirada reaberta)`,
      notifyClient: false, notifyStore: false,
    });
  } catch (e) { console.error("[pickup-reopen] alert", e); }
}
