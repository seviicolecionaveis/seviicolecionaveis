import { describe, expect, it } from "vitest";
import { auctionPixDiscountEligible, computeAuctionPixDiscountCents } from "./auction-pix-discount";

// Leilão encerrado em 05/11 às 21h de Fortaleza (00h UTC de 06/11)
const end = new Date("2026-11-06T00:00:00Z");

describe("desconto Pix de leilão", () => {
  it("vale até 23h59 do dia do encerramento (Fortaleza)", () => {
    expect(auctionPixDiscountEligible(end, new Date("2026-11-06T02:59:00Z"))).toBe(true);
  });
  it("não vale a partir de 00h do dia seguinte", () => {
    expect(auctionPixDiscountEligible(end, new Date("2026-11-06T03:00:00Z"))).toBe(false);
  });
  it("não vale para leilões já encerrados antes da regra", () => {
    const old = new Date("2026-11-05T18:00:00Z");
    expect(auctionPixDiscountEligible(old, new Date("2026-11-05T19:00:00Z"))).toBe(false);
  });
  it("é 3% do valor das cartas", () => {
    expect(computeAuctionPixDiscountCents(10000, 0)).toBe(300);
  });
});
