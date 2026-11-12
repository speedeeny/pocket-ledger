import { describe, expect, it } from "vitest";

import {
  addCategory,
  addTransaction,
  clearPlan,
  deleteCategory,
  deleteTransaction,
  emptyLedger,
  exportCsv,
  filterTransactions,
  parseLedger,
  savePlanSettings,
  setAppearance,
  setPlanItem,
  updateCategory,
  updateTransaction,
} from "@/lib/store";
import type { LedgerData } from "@/lib/types";

function ledger(): LedgerData {
  return emptyLedger();
}

function categoryId(ledgerData: LedgerData, name: string): string {
  const found = ledgerData.categories.find((c) => c.name === name);
  if (!found) throw new Error(`missing category ${name}`);
  return found.id;
}

describe("categories", () => {
  it("seeds the default categories on a new profile", () => {
    const data = ledger();
    expect(data.categories.length).toBe(12);
    expect(data.transactions).toEqual([]);
    expect(data.plan.configured).toBe(false);
  });

  it("adds a category and rejects a duplicate name regardless of case", () => {
    const data = addCategory(ledger(), "Coffee", "expense");
    expect(data.categories.some((c) => c.name === "Coffee")).toBe(true);
    expect(() => addCategory(data, "coffee", "expense")).toThrow(/already exists/);
  });

  it("rejects an empty name and an unknown kind", () => {
    expect(() => addCategory(ledger(), "   ", "expense")).toThrow(/Give the category/);
    expect(() => addCategory(ledger(), "X", "sideways")).toThrow(/expense or income/);
  });

  it("refuses to change the type of a category in use", () => {
    let data = ledger();
    const food = categoryId(data, "Groceries");
    data = addTransaction(data, {
      date: "2026-10-01",
      kind: "expense",
      amountCents: 500,
      categoryId: food,
    });
    expect(() => updateCategory(data, food, { kind: "income" })).toThrow(/cannot change/);
  });

  it("drops a plan item when its category becomes income", () => {
    let data = ledger();
    const housing = categoryId(data, "Housing");
    data = setPlanItem(data, housing, 1000);
    data = updateCategory(data, housing, { kind: "income" });
    expect(data.planItems).toEqual([]);
  });

  it("refuses to delete a category that still has transactions", () => {
    let data = ledger();
    const groceries = categoryId(data, "Groceries");
    data = addTransaction(data, {
      date: "2026-10-01",
      kind: "expense",
      amountCents: 500,
      categoryId: groceries,
    });
    expect(() => deleteCategory(data, groceries)).toThrow(/used by 1 transaction/);
  });

  it("moves transactions to another category of the same type on delete", () => {
    let data = ledger();
    const groceries = categoryId(data, "Groceries");
    const other = categoryId(data, "Other");
    data = addTransaction(data, {
      date: "2026-10-01",
      kind: "expense",
      amountCents: 500,
      categoryId: groceries,
    });
    data = deleteCategory(data, groceries, other);
    expect(data.categories.some((c) => c.id === groceries)).toBe(false);
    expect(data.transactions[0].categoryId).toBe(other);
  });

  it("refuses to move transactions to a category of another type", () => {
    let data = ledger();
    const groceries = categoryId(data, "Groceries");
    const salary = categoryId(data, "Salary");
    data = addTransaction(data, {
      date: "2026-10-01",
      kind: "expense",
      amountCents: 500,
      categoryId: groceries,
    });
    expect(() => deleteCategory(data, groceries, salary)).toThrow(/same type/);
  });
});

describe("transactions", () => {
  it("adds, updates and deletes an entry", () => {
    let data = ledger();
    const groceries = categoryId(data, "Groceries");
    data = addTransaction(data, {
      date: "2026-10-01",
      kind: "expense",
      amountCents: 1250,
      categoryId: groceries,
      note: "  Weekly shop  ",
      method: "Cash",
    });
    expect(data.transactions[0].note).toBe("Weekly shop");
    expect(data.transactions[0].method).toBe("Cash");

    const id = data.transactions[0].id;
    data = updateTransaction(data, id, { amountCents: 2000 });
    expect(data.transactions[0].amountCents).toBe(2000);

    data = deleteTransaction(data, id);
    expect(data.transactions).toEqual([]);
  });

  it("rejects a category of the wrong kind", () => {
    const data = ledger();
    const salary = categoryId(data, "Salary");
    expect(() =>
      addTransaction(data, {
        date: "2026-10-01",
        kind: "expense",
        amountCents: 500,
        categoryId: salary,
      }),
    ).toThrow(/is a income category/);
  });

  it("rejects a zero amount and a bad date", () => {
    const data = ledger();
    const groceries = categoryId(data, "Groceries");
    expect(() =>
      addTransaction(data, {
        date: "2026-10-01",
        kind: "expense",
        amountCents: 0,
        categoryId: groceries,
      }),
    ).toThrow(/greater than zero/);
    expect(() =>
      addTransaction(data, {
        date: "2026-02-30",
        kind: "expense",
        amountCents: 100,
        categoryId: groceries,
      }),
    ).toThrow(/not a valid date/);
  });

  it("filters by search, kind and category, newest first", () => {
    let data = ledger();
    const groceries = categoryId(data, "Groceries");
    const salary = categoryId(data, "Salary");
    data = addTransaction(data, {
      date: "2026-10-01",
      kind: "expense",
      amountCents: 500,
      categoryId: groceries,
      note: "Bakery",
    });
    data = addTransaction(data, {
      date: "2026-10-09",
      kind: "income",
      amountCents: 90000,
      categoryId: salary,
      note: "Pay",
    });

    expect(filterTransactions(data).map((tx) => tx.note)).toEqual(["Pay", "Bakery"]);
    expect(filterTransactions(data, { search: "bak" }).length).toBe(1);
    expect(filterTransactions(data, { kind: "income" }).length).toBe(1);
    expect(filterTransactions(data, { categoryId: groceries }).length).toBe(1);
    expect(filterTransactions(data, { start: "2026-10-05" }).length).toBe(1);
  });
});

describe("plan editing", () => {
  it("stores and removes a monthly cost", () => {
    let data = ledger();
    const housing = categoryId(data, "Housing");
    data = setPlanItem(data, housing, "12 000");
    expect(data.planItems).toEqual([{ categoryId: housing, amountCents: 1200000 }]);
    data = setPlanItem(data, housing, "");
    expect(data.planItems).toEqual([]);
  });

  it("rejects a plan item for an income category", () => {
    const data = ledger();
    expect(() => setPlanItem(data, categoryId(data, "Salary"), 100)).toThrow(/expense categories/);
  });

  it("saves the plan and marks it configured", () => {
    const data = savePlanSettings(ledger(), {
      startingCents: "100 000",
      months: 6,
      incomeCents: "0",
    });
    expect(data.plan.configured).toBe(true);
    expect(data.plan.startingCents).toBe(10000000);
    expect(data.plan.months).toBe(6);
  });

  it("validates the horizon", () => {
    expect(() =>
      savePlanSettings(ledger(), { startingCents: 0, months: 0 }),
    ).toThrow(/how many months/);
    expect(() =>
      savePlanSettings(ledger(), { startingCents: 0, months: 61 }),
    ).toThrow(/between 1 and 60/);
  });

  it("clears the plan and its costs", () => {
    let data = ledger();
    const housing = categoryId(data, "Housing");
    data = setPlanItem(data, housing, 1000);
    data = savePlanSettings(data, { startingCents: 5000, months: 6 });
    data = clearPlan(data);
    expect(data.planItems).toEqual([]);
    expect(data.plan.configured).toBe(false);
  });
});

describe("appearance", () => {
  it("merges appearance changes and normalises the language", () => {
    const data = setAppearance(ledger(), { language: "cs-CZ", mode: "dark" });
    expect(data.appearance.language).toBe("cs");
    expect(data.appearance.mode).toBe("dark");
    expect(data.appearance.palette).toBe("emerald");
  });
});

describe("persistence", () => {
  it("round-trips through JSON", () => {
    let data = ledger();
    data = addTransaction(data, {
      date: "2026-10-01",
      kind: "expense",
      amountCents: 500,
      categoryId: categoryId(data, "Groceries"),
    });
    const restored = parseLedger(JSON.parse(JSON.stringify(data)));
    expect(restored.transactions.length).toBe(1);
    expect(restored.categories.length).toBe(12);
  });

  it("repairs a broken or empty payload", () => {
    expect(parseLedger(null).categories.length).toBe(12);
    expect(parseLedger({}).categories.length).toBe(12);
    expect(parseLedger({ categories: [] }).categories.length).toBe(12);
  });

  it("clamps an out-of-range horizon stored by an older version", () => {
    const restored = parseLedger({ plan: { months: 999 } });
    expect(restored.plan.months).toBe(60);
  });
});

describe("CSV export", () => {
  it("quotes every cell and keeps the header", () => {
    let data = ledger();
    data = addTransaction(data, {
      date: "2026-10-01",
      kind: "expense",
      amountCents: 1250,
      categoryId: categoryId(data, "Groceries"),
      note: 'Shop, "big"',
    });
    const csv = exportCsv(data.transactions, data);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe('"Date","Type","Category","Amount","Method","Note"');
    expect(lines[1]).toContain('"Shop, ""big"""');
    expect(lines[1]).toContain('"12.50"');
  });
});
