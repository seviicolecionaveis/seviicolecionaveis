// Brevo (Sendinblue) helpers — server only.
// Calls go through the Lovable connector gateway.

const GATEWAY = "https://connector-gateway.lovable.dev/brevo";
const FOLDER_NAME = "Sevii";
const LIST_NEWSLETTER = "Newsletter";
const LIST_CUSTOMERS = "Clientes";

function authHeaders() {
  const lovKey = process.env.LOVABLE_API_KEY;
  const brevoKey = process.env.BREVO_API_KEY;
  if (!lovKey) throw new Error("LOVABLE_API_KEY ausente");
  if (!brevoKey) throw new Error("BREVO_API_KEY ausente — conecte a Brevo em Conectores");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${lovKey}`,
    "X-Connection-Api-Key": brevoKey,
  };
}

async function brevo<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${GATEWAY}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init.headers ?? {}) },
  });
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const msg =
      (body && (body.message || body.error || body.code)) ||
      `Brevo ${res.status}`;
    const err: any = new Error(`Brevo: ${msg}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body as T;
}

// ---- Folder / list management ----

let cachedFolderId: number | null = null;
const cachedListIds: Record<string, number> = {};

async function ensureFolderId(): Promise<number> {
  if (cachedFolderId) return cachedFolderId;
  const list = await brevo<{ folders?: Array<{ id: number; name: string }> }>(
    `/contacts/folders?limit=50&offset=0`,
    { method: "GET" }
  );
  const found = list.folders?.find((f) => f.name === FOLDER_NAME);
  if (found) {
    cachedFolderId = found.id;
    return found.id;
  }
  const created = await brevo<{ id: number }>(`/contacts/folders`, {
    method: "POST",
    body: JSON.stringify({ name: FOLDER_NAME }),
  });
  cachedFolderId = created.id;
  return created.id;
}

async function ensureListId(name: string): Promise<number> {
  if (cachedListIds[name]) return cachedListIds[name];
  const folderId = await ensureFolderId();
  const lists = await brevo<{ lists?: Array<{ id: number; name: string }> }>(
    `/contacts/folders/${folderId}/lists?limit=50&offset=0`,
    { method: "GET" }
  );
  const found = lists.lists?.find((l) => l.name === name);
  if (found) {
    cachedListIds[name] = found.id;
    return found.id;
  }
  const created = await brevo<{ id: number }>(`/contacts/lists`, {
    method: "POST",
    body: JSON.stringify({ name, folderId }),
  });
  cachedListIds[name] = created.id;
  return created.id;
}

export async function ensureNewsletterListId() {
  return ensureListId(LIST_NEWSLETTER);
}
export async function ensureCustomersListId() {
  return ensureListId(LIST_CUSTOMERS);
}

// ---- Contact upsert ----

export interface BrevoUpsertInput {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  sms?: string | null;
  birthday?: string | null; // YYYY-MM-DD
  attributes?: Record<string, any>;
  listIds?: number[];
}

export async function upsertContact(input: BrevoUpsertInput) {
  const attributes: Record<string, any> = { ...(input.attributes ?? {}) };
  if (input.firstName) attributes.FIRSTNAME = input.firstName;
  if (input.lastName) attributes.LASTNAME = input.lastName;
  if (input.sms) attributes.SMS = input.sms;
  if (input.birthday) attributes.BIRTHDAY = input.birthday;

  await brevo(`/contacts`, {
    method: "POST",
    body: JSON.stringify({
      email: input.email.trim().toLowerCase(),
      attributes,
      listIds: input.listIds && input.listIds.length ? input.listIds : undefined,
      updateEnabled: true,
    }),
  });
  return { ok: true };
}

// ---- Sender management ----

export async function ensureSender(opts: { name: string; email: string }) {
  const list = await brevo<{ senders?: Array<{ id: number; email: string; active?: boolean }> }>(
    `/senders`,
    { method: "GET" }
  );
  const found = list.senders?.find(
    (s) => s.email.toLowerCase() === opts.email.toLowerCase()
  );
  if (found) return { id: found.id, active: !!found.active, existed: true };
  const created = await brevo<{ id: number }>(`/senders`, {
    method: "POST",
    body: JSON.stringify({ name: opts.name, email: opts.email }),
  });
  return { id: created.id, active: false, existed: false };
}

// ---- Email campaign ----

export interface CreateCampaignInput {
  name: string;
  subject: string;
  htmlContent: string;
  sender: { name: string; email: string; id?: number };
  listIds: number[];
  replyTo?: string;
}

export async function createEmailCampaign(input: CreateCampaignInput) {
  const body: any = {
    name: input.name,
    subject: input.subject,
    htmlContent: input.htmlContent,
    sender: input.sender,
    recipients: { listIds: input.listIds },
    type: "classic",
  };
  if (input.replyTo) body.replyTo = input.replyTo;
  const out = await brevo<{ id: number }>(`/emailCampaigns`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return out;
}

export async function sendCampaignNow(campaignId: number) {
  await brevo(`/emailCampaigns/${campaignId}/sendNow`, { method: "POST" });
  return { ok: true };
}

// ---- Account / verify ----

export async function getAccount() {
  return brevo<{ email: string; firstName?: string; plan?: any[] }>(`/account`, {
    method: "GET",
  });
}
