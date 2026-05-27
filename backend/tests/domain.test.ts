import { describe, expect, it } from "vitest";
import {
  calculateQuoteLineItems,
  searchPastOrders,
} from "../src/domain/tools.js";

describe("calculateQuoteLineItems", () => {
  it("computes unit price and total for TUV configuration", async () => {
    const result = await calculateQuoteLineItems({
      vehicle_model_id: "VEH-TUV-1200",
      configuration_option_ids: [
        "opt-4wd",
        "opt-diesel",
        "opt-long-wb",
        "opt-level3",
      ],
      qty: 10,
    });

    expect(result.unit_price).toBe(377000);
    expect(result.total_usd).toBe(3770000);
  });
});

describe("searchPastOrders", () => {
  it("returns UAE MOD history", async () => {
    const rows = await searchPastOrders("CLI-UAE-MOD", "VEH-TUV-1200");
    expect(rows).toHaveLength(1);
    expect(rows[0].order_id).toBe("ORD-2025-019");
  });
});
