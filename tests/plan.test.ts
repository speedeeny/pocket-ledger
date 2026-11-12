import { describe, expect, it } from "vitest";

import {
  buildPlan,
  commitmentsCents,
  freeMonthlyCents,
  moneyLeftCents,
  monthState,
  monthStateView,
  planMonthItems,
  planStatus,
  remainderCents,
  resourcesCents,
  shortfallCents,
  spareCents,
  spendingByCategory,
  unplannedSpending,
} from "@/lib/plan";
import type { Category, Transaction } from "@/lib/types";

const RENT = "cat-rent";
const FOOD = "cat-food";
const FUN = "cat-fun";

const categories: Category[] = [
  { id: RENT, name: "Housing", kind: "expense", color: "#8B5CF6" },
  { id: FOOD, name: "Groceries", kind: "expense", color: "#22C55E" },
  { id: FUN, name: "Fun", kind: "expense", color: "#EC4899" },
  { id: "cat-salary", name: "Salary", kind: "income", color: "#16A34A" },
];

function tx(
  id: string,
  date: string,
  amountCents: number,
  categoryId: string,
  kind: "expense" | "income" = "expense",
): Transaction {
  return { id, date, kind, amountCents, categoryId, note: "", method: "Card" };
}

const items = [
  { categoryId: RENT, amountCents: 1200000 },
  { categoryId: FOOD, amountCents: 500000 },
];

function plan(overrides: Partial<Parameters<typeof buildPlan>[0]> = {}) {
  return buildPlan({
    configured: true,
    startingCents: 10000000,
    months: 6,
    incomeCents: 0,
    startYear: 2026,
    startMonth: 10,
    items,
    transactions: [],
    reference: "2026-10-15",
    ...overrides,
  });
}

describe("plan arithmetic", () => {
  it("matches the README example", () => {
    const p = plan();
    expect(resourcesCents(p)).toBe(10000000);
    expect(commitmentsCents(p)).toBe(1700000 * 6);
    expect(spareCents(p)).toBe(10000000 - 10200000);
    expect(shortfallCents(p)).toBe(200000);
    expect(planStatus(p)).toBe("short");
    expect(freeMonthlyCents(p)).toBe(0);
  });

  it("splits what is left into a monthly allowance", () => {
    const p = plan({ startingCents: 20000000 });
    expect(spareCents(p)).toBe(20000000 - 10200000);
    expect(freeMonthlyCents(p)).toBe(Math.floor(9800000 / 6));
    expect(planStatus(p)).toBe("ok");
  });

  it("counts monthly income as resources", () => {
    const p = plan({ startingCents: 0, incomeCents: 1700000 });
    expect(resourcesCents(p)).toBe(1700000 * 6);
    expect(spareCents(p)).toBe(0);
    expect(planStatus(p)).toBe("tight");
  });

  it("calls a tiny free allowance tight", () => {
    const p = plan({ startingCents: 10200000 + 10000 * 6 });
    expect(freeMonthlyCents(p)).toBe(10000);
    expect(planStatus(p)).toBe("tight");
  });

  it("reports the odd cents left over", () => {
    const p = plan({ startingCents: 10200000 + 100 });
    expect(freeMonthlyCents(p)).toBe(16);
    expect(remainderCents(p)).toBe(4);
  });

  it("has an unset state before the plan is configured", () => {
    const p = plan({ configured: false });
    expect(planStatus(p)).toBe("unset");
    expect(p.schedule).toEqual([]);
  });
});

describe("monthly schedule", () => {
  const transactions = [
    tx("t1", "2026-10-03", 300000, RENT),
    tx("t2", "2026-10-04", 100000, FUN),
    tx("t3", "2026-12-01", 50000, FOOD),
  ];

  it("splits reserved and free spending", () => {
    const p = plan({ startingCents: 20000000, transactions });
    const october = monthState(p.schedule, 2026, 10)!;
    expect(october.fixedSpentCents).toBe(300000);
    expect(october.freeSpentCents).toBe(100000);
    expect(october.started).toBe(true);
  });

  it("leaves months that have not started empty", () => {
    const p = plan({ startingCents: 20000000, transactions });
    const december = monthState(p.schedule, 2026, 12)!;
    expect(december.started).toBe(false);
    expect(december.fixedSpentCents).toBe(0);
    expect(december.freeSpentCents).toBe(0);
  });

  it("reports a month over the plan", () => {
    const p = plan({
      startingCents: 20000000,
      transactions: [tx("big", "2026-10-05", 5000000, FUN)],
    });
    const view = monthStateView(monthState(p.schedule, 2026, 10)!);
    expect(view.verdict).toBe("over");
    expect(view.overCents).toBeGreaterThan(0);
  });

  it("flags a month near the limit at 85%", () => {
    const p = plan({ startingCents: 20000000 });
    const october = monthState(p.schedule, 2026, 10)!;
    const planned = october.fixedCents + october.freeCents;
    const spend = Math.ceil(planned * 0.86);
    const withSpend = plan({
      startingCents: 20000000,
      transactions: [tx("s", "2026-10-05", spend, FUN)],
    });
    expect(monthStateView(monthState(withSpend.schedule, 2026, 10)!).verdict).toBe("near");
  });

  it("computes real money left", () => {
    const p = plan({ startingCents: 20000000, transactions });
    expect(moneyLeftCents(p)).toBe(20000000 - 300000 - 100000);
  });
});

describe("plan rows", () => {
  const transactions = [
    tx("t1", "2026-10-03", 1300000, RENT),
    tx("t2", "2026-10-04", 90000, FOOD),
    tx("t3", "2026-10-05", 250000, FUN),
  ];

  it("shows spending per reserved cost", () => {
    const rows = planMonthItems(items, transactions, 2026, 10);
    const rent = rows.find((row) => row.categoryId === RENT)!;
    expect(rent.spentCents).toBe(1300000);
    expect(rent.count).toBe(1);
    expect(rows[0].categoryId).toBe(RENT); // largest first
  });

  it("groups everything outside the plan", () => {
    const row = unplannedSpending(items, transactions, categories, 2026, 10);
    expect(row.spentCents).toBe(250000);
    expect(row.count).toBe(1);
  });

  it("sorts category spending largest first", () => {
    const rows = spendingByCategory(transactions, categories, 2026, 10);
    expect(rows.map((row) => row.categoryId)).toEqual([RENT, FUN, FOOD]);
  });
});
