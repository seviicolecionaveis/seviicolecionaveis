import { describe, expect, it } from "vitest";
import { ACTIVE_PICKUP_POINTS, validatePickupPoint } from "./pickup-points";

describe("pickup point availability", () => {
  it("excludes Vista Aruana from new choices and rejects stale selections", () => {
    expect(ACTIVE_PICKUP_POINTS).not.toContain("aruana");
    expect(validatePickupPoint("aruana")).not.toBeNull();
  });
  it("keeps Aeroporto available", () => {
    expect(ACTIVE_PICKUP_POINTS).toContain("aeroporto");
    expect(validatePickupPoint("aeroporto")).toBeNull();
  });
});