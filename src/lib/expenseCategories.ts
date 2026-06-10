export const EXPENSE_CATEGORIES = [
  "Utilities",
  "Supplies",
  "Maintenance",
  "Salaries",
  "Food & Beverage",
  "Minimart",
  "Taxes",
  "Other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
