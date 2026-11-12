import { addMonths, monthBounds, parseDate, today } from "./dates";
import type { Category, MonthState, Transaction } from "./types";

export interface PlanItemRow {
  categoryId: string;
  amountCents: number;
  spentCents: number;
  count: number;
}

export interface SpendingRow {
  categoryId: string;
  name: string;
  color: string;
  spentCents: number;
  count: number;
}

export interface MonthTotals {
  fixedSpentCents: number;
  freeSpentCents: number;
}

/** Split a month's expenses into "reserved" (plan items) and everything else. */
export function monthTotals(
  transactions: readonly Transaction[],
  planCategoryIds: ReadonlySet<string>,
  start: string,
  end: string,
): MonthTotals {
  let fixedSpentCents = 0;
  let freeSpentCents = 0;
  for (const tx of transactions) {
    if (tx.kind !== "expense") continue;
    if (tx.date < start || tx.date > end) continue;
    if (planCategoryIds.has(tx.categoryId)) fixedSpentCents += tx.amountCents;
    else freeSpentCents += tx.amountCents;
  }
  return { fixedSpentCents, freeSpentCents };
}

/** The monthly free-spending allowance for one set of inputs. */
export function freeFor(
  startingCents: number,
  incomeCents: number,
  fixedCents: number,
  months: number,
): number {
  if (months <= 0) return 0;
  const spare = startingCents + incomeCents * months - fixedCents * months;
  if (spare <= 0) return 0;
  return Math.floor(spare / months);
}

export interface BuildPlanInput {
  configured: boolean;
  startingCents: number;
  months: number;
  incomeCents: number;
  startYear: number;
  startMonth: number;
  items: ReadonlyArray<{ categoryId: string; amountCents: number }>;
  transactions: readonly Transaction[];
  /** Reference date (ISO); defaults to today. */
  reference?: string;
}

/** Build the plan together with each month's real spending. */
export function buildPlan(input: BuildPlanInput): {
  configured: boolean;
  startingCents: number;
  months: number;
  incomeCents: number;
  startYear: number;
  startMonth: number;
  items: BuildPlanInput["items"];
  schedule: MonthState[];
  currentYear: number;
  currentMonth: number;
} {
  const anchor = parseDate(input.reference ?? today());
  const [anchorYear, anchorMonth] = anchor.split("-").map(Number);
  const months = Math.max(1, Math.min(60, Math.round(input.months) || 6));

  if (!input.configured) {
    return {
      configured: false,
      startingCents: input.startingCents,
      months,
      incomeCents: input.incomeCents,
      startYear: input.startYear,
      startMonth: input.startMonth,
      items: [],
      schedule: [],
      currentYear: anchorYear,
      currentMonth: anchorMonth,
    };
  }

  const fixed = input.items.reduce((sum, item) => sum + item.amountCents, 0);
  const free = freeFor(input.startingCents, input.incomeCents, fixed, months);
  const planCategoryIds = new Set(input.items.map((item) => item.categoryId));

  const schedule: MonthState[] = [];
  let balance = input.startingCents;
  const anchorDay = anchor;

  for (let offset = 0; offset < months; offset += 1) {
    const [year, month] = addMonths(input.startYear, input.startMonth, offset);
    const [first, last] = monthBounds(year, month);
    const started = last < anchorDay || (first <= anchorDay && anchorDay <= last);

    const { fixedSpentCents, freeSpentCents } = started
      ? monthTotals(input.transactions, planCategoryIds, first, last)
      : { fixedSpentCents: 0, freeSpentCents: 0 };

    balance += input.incomeCents - fixed - free;
    schedule.push({
      year,
      month,
      incomeCents: input.incomeCents,
      fixedCents: fixed,
      freeCents: free,
      fixedSpentCents,
      freeSpentCents,
      balanceCents: balance,
      started,
    });
  }

  return {
    configured: true,
    startingCents: input.startingCents,
    months,
    incomeCents: input.incomeCents,
    startYear: input.startYear,
    startMonth: input.startMonth,
    items: input.items,
    schedule,
    currentYear: anchorYear,
    currentMonth: anchorMonth,
  };
}

export function fixedMonthlyCents(plan: { items: ReadonlyArray<{ amountCents: number }> }): number {
  return plan.items.reduce((sum, item) => sum + item.amountCents, 0);
}

export function resourcesCents(plan: {
  startingCents: number;
  incomeCents: number;
  months: number;
}): number {
  return plan.startingCents + plan.incomeCents * plan.months;
}

export function commitmentsCents(plan: {
  items: ReadonlyArray<{ amountCents: number }>;
  months: number;
}): number {
  return fixedMonthlyCents(plan) * plan.months;
}

/** Everything left after the fixed costs, before free spending. */
export function spareCents(plan: Parameters<typeof resourcesCents>[0] & Parameters<typeof commitmentsCents>[0]): number {
  return resourcesCents(plan) - commitmentsCents(plan);
}

export function shortfallCents(plan: Parameters<typeof spareCents>[0]): number {
  return Math.max(0, -spareCents(plan));
}

export function freeMonthlyCents(plan: Parameters<typeof spareCents>[0]): number {
  const spare = spareCents(plan);
  if (plan.months <= 0 || spare <= 0) return 0;
  return Math.floor(spare / plan.months);
}

export function plannedMonthlyCents(plan: Parameters<typeof spareCents>[0]): number {
  return fixedMonthlyCents(plan) + freeMonthlyCents(plan);
}

/** Odd cents left over when the allowance is split evenly. */
export function remainderCents(plan: Parameters<typeof spareCents>[0]): number {
  const spare = spareCents(plan);
  return Math.max(0, spare - freeMonthlyCents(plan) * plan.months);
}

export function planStatus(plan: Parameters<typeof spareCents>[0] & { configured: boolean }): "short" | "tight" | "ok" | "unset" {
  if (!plan.configured) return "unset";
  if (shortfallCents(plan)) return "short";
  const free = freeMonthlyCents(plan);
  const fixed = fixedMonthlyCents(plan);
  if (free <= 0) return "tight";
  if (fixed && free < Math.floor(fixed / 10)) return "tight";
  return "ok";
}

export function monthState(
  schedule: readonly MonthState[],
  year: number,
  month: number,
): MonthState | null {
  return schedule.find((state) => state.year === year && state.month === month) ?? null;
}

export function currentMonthState(
  schedule: readonly MonthState[],
  year: number,
  month: number,
): MonthState | null {
  return monthState(schedule, year, month);
}

/** Money actually left: starting money plus income, minus real spending. */
export function moneyLeftCents(plan: {
  startingCents: number;
  incomeCents: number;
  schedule: readonly MonthState[];
}): number {
  const started = plan.schedule.filter((state) => state.started);
  const spent = started.reduce((sum, state) => sum + state.fixedSpentCents + state.freeSpentCents, 0);
  return plan.startingCents + plan.incomeCents * started.length - spent;
}

export interface MonthStateView {
  plannedCents: number;
  spentCents: number;
  remainingCents: number;
  ratio: number;
  overCents: number;
  freeRemainingCents: number;
  fixedRemainingCents: number;
  verdict: "within" | "near" | "over";
}

export function monthStateView(state: MonthState): MonthStateView {
  const plannedCents = state.fixedCents + state.freeCents;
  const spentCents = state.fixedSpentCents + state.freeSpentCents;
  const ratio = plannedCents <= 0 ? 0 : spentCents / plannedCents;
  const verdict = ratio >= 1 ? "over" : ratio >= 0.85 ? "near" : "within";
  return {
    plannedCents,
    spentCents,
    remainingCents: state.started ? plannedCents - spentCents : plannedCents,
    ratio,
    overCents: Math.max(0, spentCents - plannedCents),
    freeRemainingCents: state.freeCents - state.freeSpentCents,
    fixedRemainingCents: state.fixedCents - state.fixedSpentCents,
    verdict,
  };
}

/** Plan items with what was really spent on each in the given month. */
export function planMonthItems(
  items: BuildPlanInput["items"],
  transactions: readonly Transaction[],
  year: number,
  month: number,
): PlanItemRow[] {
  const [start, end] = monthBounds(year, month);
  const spent = new Map<string, { cents: number; count: number }>();
  for (const tx of transactions) {
    if (tx.kind !== "expense" || tx.date < start || tx.date > end) continue;
    const entry = spent.get(tx.categoryId) ?? { cents: 0, count: 0 };
    entry.cents += tx.amountCents;
    entry.count += 1;
    spent.set(tx.categoryId, entry);
  }
  return [...items]
    .sort((a, b) => b.amountCents - a.amountCents)
    .map((item) => {
      const entry = spent.get(item.categoryId) ?? { cents: 0, count: 0 };
      return {
        categoryId: item.categoryId,
        amountCents: item.amountCents,
        spentCents: entry.cents,
        count: entry.count,
      };
    });
}

/** Everything spent in a month outside the plan's recurring costs. */
export function unplannedSpending(
  items: BuildPlanInput["items"],
  transactions: readonly Transaction[],
  categories: readonly Category[],
  year: number,
  month: number,
): SpendingRow {
  const planned = new Set(items.map((item) => item.categoryId));
  const byCategory = spendingByCategory(transactions, categories, year, month);
  const extra = byCategory.filter((row) => !planned.has(row.categoryId));
  return {
    categoryId: "",
    name: "Everything else",
    color: "#94A3B8",
    spentCents: extra.reduce((sum, row) => sum + row.spentCents, 0),
    count: extra.reduce((sum, row) => sum + row.count, 0),
  };
}

export function spendingByCategory(
  transactions: readonly Transaction[],
  categories: readonly Category[],
  year: number,
  month: number,
): SpendingRow[] {
  const [start, end] = monthBounds(year, month);
  const byId = new Map(categories.map((category) => [category.id, category]));
  const spent = new Map<string, { cents: number; count: number }>();

  for (const tx of transactions) {
    if (tx.kind !== "expense" || tx.date < start || tx.date > end) continue;
    const entry = spent.get(tx.categoryId) ?? { cents: 0, count: 0 };
    entry.cents += tx.amountCents;
    entry.count += 1;
    spent.set(tx.categoryId, entry);
  }

  return [...spent.entries()]
    .map(([categoryId, entry]) => ({
      categoryId,
      name: byId.get(categoryId)?.name ?? categoryId,
      color: byId.get(categoryId)?.color ?? "#64748B",
      spentCents: entry.cents,
      count: entry.count,
    }))
    .sort((a, b) => b.spentCents - a.spentCents || a.name.localeCompare(b.name));
}

export interface Totals {
  income: number;
  expense: number;
  net: number;
  count: number;
}

export function totalsInMonth(
  transactions: readonly Transaction[],
  year: number,
  month: number,
): Totals {
  const [start, end] = monthBounds(year, month);
  let income = 0;
  let expense = 0;
  let count = 0;
  for (const tx of transactions) {
    if (tx.date < start || tx.date > end) continue;
    count += 1;
    if (tx.kind === "income") income += tx.amountCents;
    else expense += tx.amountCents;
  }
  return { income, expense, net: income - expense, count };
}
