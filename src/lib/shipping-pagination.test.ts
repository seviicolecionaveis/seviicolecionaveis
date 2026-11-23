import { describe, expect, it } from "vitest";
import { loadShippingPages } from "./shipping-pagination";

describe("shipping history pagination", () => {
  it("keeps the newest open order after more than 2000 completed orders", async () => {
    const history = Array.from({ length: 2501 }, (_, id) => ({
      id, status: id === 2500 ? "paid" : "delivered",
    }));
    const rows = await loadShippingPages(async (from, to) => history.slice(from, to + 1));
    expect(rows).toHaveLength(2501);
    expect(rows.filter(row => row.status === "paid")).toEqual([{ id: 2500, status: "paid" }]);
    expect(new Set(rows.map(row => row.id)).size).toBe(2501);
  });

  it("advances by actual rows when the API caps pages below the requested size", async () => {
    const history = Array.from({ length: 1103 }, (_, id) => id);
    const rows = await loadShippingPages(async (from, to) => history.slice(from, Math.min(to + 1, from + 100)));
    expect(rows).toEqual(history);
    expect(rows.at(-1)).toBe(1102);
  });

  it("returns an empty list for an empty result", async () => {
    expect(await loadShippingPages(async () => [])).toEqual([]);
  });

  it("rejects a later-page failure instead of returning a silently truncated list", async () => {
    await expect(loadShippingPages(async from => {
      if (from > 0) throw new Error("Page failed");
      return [1, 2];
    })).rejects.toThrow("Page failed");
  });
});