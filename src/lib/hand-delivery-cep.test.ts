import { describe, it, expect } from "vitest";
import { isAracajuCep } from "./hand-delivery";
describe("isAracajuCep", () => {
  it("CEP de Aracaju bloqueia Correios", () => expect(isAracajuCep("49000-123")).toBe(true));
  it("CEP fora de Aracaju libera Correios", () => expect(isAracajuCep("49100-000")).toBe(false));
});
