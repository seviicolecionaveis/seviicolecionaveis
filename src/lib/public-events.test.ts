import { describe, expect, it } from "vitest";
import {
  buildPrintableList,
  canCancelRegistration,
  canRegister,
  eventDisplayStatus,
  eventErrorMessage,
  formatEventDate,
  formatTimeRange,
  registrationsToCsv,
  slugifyEventTitle,
  todayYmd,
  type EventRegistration,
} from "./public-events";

const baseEvent = {
  event_date: "2026-12-01",
  registration_status: "open" as const,
  capacity: null as number | null,
};

describe("eventDisplayStatus", () => {
  it("evento passado é 'finished' mesmo com inscrições abertas", () => {
    expect(eventDisplayStatus(baseEvent, 0, "2026-12-02")).toBe("finished");
  });

  it("evento no dia de hoje ainda aceita inscrições", () => {
    expect(eventDisplayStatus(baseEvent, 0, "2026-12-01")).toBe("open");
  });

  it("status admin 'closed' vira 'closed'", () => {
    expect(
      eventDisplayStatus({ ...baseEvent, registration_status: "closed" }, 0, "2026-11-01"),
    ).toBe("closed");
  });

  it("lotação atingida vira 'full'", () => {
    expect(eventDisplayStatus({ ...baseEvent, capacity: 10 }, 10, "2026-11-01")).toBe("full");
    expect(eventDisplayStatus({ ...baseEvent, capacity: 10 }, 9, "2026-11-01")).toBe("open");
  });

  it("sem limite de vagas nunca esgota", () => {
    expect(eventDisplayStatus({ ...baseEvent, capacity: null }, 9999, "2026-11-01")).toBe("open");
  });
});

describe("canRegister / canCancelRegistration", () => {
  it("só confirma com inscrições abertas", () => {
    expect(canRegister("open")).toBe(true);
    expect(canRegister("full")).toBe(false);
    expect(canRegister("closed")).toBe(false);
    expect(canRegister("finished")).toBe(false);
  });

  it("cancela com inscrições abertas ou esgotadas, nunca encerradas", () => {
    expect(canCancelRegistration("open")).toBe(true);
    expect(canCancelRegistration("full")).toBe(true);
    expect(canCancelRegistration("closed")).toBe(false);
    expect(canCancelRegistration("finished")).toBe(false);
  });
});

describe("slugifyEventTitle", () => {
  it("remove acentos e caracteres especiais", () => {
    expect(slugifyEventTitle("Lançamento Réinado Delta!")).toBe("lancamento-reinado-delta");
  });

  it("cai para 'evento' quando não sobra nada", () => {
    expect(slugifyEventTitle("!!!")).toBe("evento");
  });
});

describe("formatação", () => {
  it("formata data por extenso", () => {
    expect(formatEventDate("2026-11-15")).toBe("15 de novembro de 2026");
  });

  it("formata intervalo de horário", () => {
    expect(formatTimeRange("14:30", "18:00")).toBe("14h30 às 18h");
  });

  it("todayYmd usa o fuso de Fortaleza", () => {
    // 2026-11-03 02:30 UTC ainda é 02/11 em Fortaleza (UTC-3)
    expect(todayYmd(new Date("2026-11-03T02:30:00Z"))).toBe("2026-11-02");
    expect(todayYmd(new Date("2026-11-03T03:30:00Z"))).toBe("2026-11-03");
  });
});

describe("buildPrintableList", () => {
  const reg = (name: string, status = "confirmed") =>
    ({ full_name: name, phone: null, status }) as unknown as EventRegistration;

  it("ordena alfabeticamente e numera a partir de 1", () => {
    const list = buildPrintableList([reg("Zélia"), reg("Ana"), reg("Carlos")]);
    expect(list.map((r) => r.full_name)).toEqual(["Ana", "Carlos", "Zélia"]);
    expect(list.map((r) => r.numero)).toEqual([1, 2, 3]);
  });

  it("exclui cancelados da lista de presença", () => {
    const list = buildPrintableList([reg("Ana"), reg("Beto", "cancelled")]);
    expect(list).toHaveLength(1);
    expect(list[0].full_name).toBe("Ana");
  });
});

describe("registrationsToCsv", () => {
  const reg = (over: Partial<EventRegistration>): EventRegistration => ({
    id: "1",
    event_id: "e",
    user_id: "u",
    full_name: "Ana",
    email: "ana@x.com",
    phone: "79999999999",
    status: "confirmed",
    confirmed_at: "2026-11-01T10:00:00Z",
    cancelled_at: null,
    checked_in_at: null,
    checked_in_by: null,
    created_at: "2026-11-01T10:00:00Z",
    ...over,
  });

  it("gera cabeçalho e escapa células com ponto e vírgula", () => {
    const csv = registrationsToCsv([reg({ full_name: 'Ana; "Maria"' })]);
    expect(csv).toContain("Nº;Nome completo;Telefone;E-mail;Data da confirmação;Status;Check-in");
    expect(csv).toContain('"Ana; ""Maria"""');
  });
});

describe("eventErrorMessage", () => {
  it("traduz códigos conhecidos", () => {
    expect(eventErrorMessage("P0409: event_full")).toBe("As vagas deste evento se esgotaram.");
    expect(eventErrorMessage("registrations_closed")).toBe("As inscrições deste evento estão encerradas.");
  });

  it("mantém mensagens desconhecidas", () => {
    expect(eventErrorMessage("outro erro")).toBe("outro erro");
  });
});
