import { describe, expect, it } from "vitest";
import {
  SERVICE_ORDER_METHOD_LABEL,
  serviceOrderMethodLabel,
} from "./fulfillment-labels";

describe("fulfillment-labels", () => {
  it("usa 'Entrega em mãos' para app e 'Retirada em mãos' para presencial", () => {
    expect(SERVICE_ORDER_METHOD_LABEL.app).toBe("Entrega em mãos");
    expect(SERVICE_ORDER_METHOD_LABEL.presencial).toBe("Retirada em mãos");
  });

  it("usa 'Retirada em eventos' para evento", () => {
    expect(SERVICE_ORDER_METHOD_LABEL.evento).toBe("Retirada em eventos");
  });

  it("cobre todas as modalidades conhecidas", () => {
    for (const m of ["correios", "app", "arte_em_cards", "presencial", "evento"]) {
      expect(serviceOrderMethodLabel(m)).not.toBe(m);
    }
  });

  it("devolve o próprio valor para modalidade desconhecida e '—' para vazio", () => {
    expect(serviceOrderMethodLabel("outra_coisa")).toBe("outra_coisa");
    expect(serviceOrderMethodLabel(null)).toBe("—");
    expect(serviceOrderMethodLabel(undefined)).toBe("—");
  });
});
