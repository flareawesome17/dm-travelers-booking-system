import { describe, expect, it } from "vitest";
import { createExpenseSchema } from "./validation-schemas";

const validExpense = {
  description: "Restock minimart",
  amount: 5940.06,
  category: "Minimart",
  date: "2026-06-08",
  notes: "For resale",
};

describe("createExpenseSchema", () => {
  it("accepts the Minimart expense category", () => {
    expect(createExpenseSchema.safeParse(validExpense).success).toBe(true);
  });

  it("rejects unsupported expense categories before the database insert", () => {
    const result = createExpenseSchema.safeParse({
      ...validExpense,
      category: "Unlisted category",
    });

    expect(result.success).toBe(false);
  });
});
