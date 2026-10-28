import { describe, expect, it } from "vitest";

import {
  SUPERFRETE_MIN_INSURANCE_VALUE,
  superfreteInsuranceValue,
} from "./superfrete-label";

describe("superfreteInsuranceValue", () => {
  it("eleva pedido barato ao mínimo de R$ 25,63 do provedor", () => {
    expect(superfreteInsuranceValue(2)).toBe(SUPERFRETE_MIN_INSURANCE_VALUE);
    expect(superfreteInsuranceValue(1)).toBe(25.63);
  });

  it("mantém o total quando ele já atinge o mínimo", () => {
    expect(superfreteInsuranceValue(25.63)).toBe(25.63);
    expect(superfreteInsuranceValue(120)).toBe(120);
  });
});
