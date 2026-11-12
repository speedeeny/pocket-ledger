import { parseAmount, parsePlanAmount } from "./money";
import { parseDate, today } from "./dates";
import { ValidationError } from "./errors";
import {
  CATEGORY_COLORS,
  DEFAULT_CATEGORIES,
  DEFAULT_PLAN_MONTHS,
  MAX_PLAN_MONTHS,
  type Appearance,
  type Category,
  type Kind,
  type LedgerData,
  type Transaction,
} from "./types";
import { DEFAULT_LANGUAGE, normaliseLanguage, systemLanguage } from "./i18n";
import { DEFAULT_CURRENCY } from "./money";

export const STORAGE_KEY = "pocket-ledger/v2";
export const DATA_VERSION = 2;

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function defaultAppearance(): Appearance {
  return {
    language: DEFAULT_LANGUAGE,
    mode: "light",
    palette: "emerald",
    currency: DEFAULT_CURRENCY,
  };
}

/**
 * A brand-new profile. Deliberately deterministic (English, light, emerald)
 * so the server and the first client render agree; the visitor's language is
 * applied in :func:`loadLedger` once we are in the browser.
 */
export function emptyLedger(): LedgerData {
  const now = new Date();
  return {
    version: DATA_VERSION,
    categories: DEFAULT_CATEGORIES.map(([name, kind, color]) => ({
      id: newId(),
      name,
      kind,
      color,
    })),
    transactions: [],
    planItems: [],
    plan: {
      configured: false,
      startingCents: 0,
      months: DEFAULT_PLAN_MONTHS,
      incomeCents: 0,
      startYear: now.getFullYear(),
      startMonth: now.getMonth() + 1,
    },
    appearance: defaultAppearance(),
  };
}

function cleanName(name: string): string {
  const cleaned = String(name ?? "").replace(/\s+/g, " ").trim();
  if (!cleaned) throw new ValidationError("Give the category a name.");
  if (cleaned.length > 40) {
    throw new ValidationError("Category names can be at most 40 characters.");
  }
  return cleaned;
}

function cleanKind(kind: string): Kind {
  const value = String(kind ?? "").trim().toLowerCase();
  if (value !== "expense" && value !== "income") {
    throw new ValidationError("Choose either expense or income.");
  }
  return value;
}

function cleanMethod(method: string): string {
  const cleaned = String(method ?? "").replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, 40) : "Other";
}

export function addCategory(
  data: LedgerData,
  name: string,
  kind: string,
  color?: string,
): LedgerData {
  const cleaned = cleanName(name);
  const cleanK = cleanKind(kind);
  if (data.categories.some((c) => c.name.toLowerCase() === cleaned.toLowerCase())) {
    throw new ValidationError(`A category called '${cleaned}' already exists.`);
  }
  const category: Category = {
    id: newId(),
    name: cleaned,
    kind: cleanK,
    color: color ?? CATEGORY_COLORS[0],
  };
  return { ...data, categories: [...data.categories, category] };
}

export function updateCategory(
  data: LedgerData,
  id: string,
  changes: { name?: string; kind?: string; color?: string },
): LedgerData {
  const current = data.categories.find((c) => c.id === id);
  if (!current) throw new ValidationError("That category no longer exists.");

  const name = changes.name !== undefined ? cleanName(changes.name) : current.name;
  const kind = changes.kind !== undefined ? cleanKind(changes.kind) : current.kind;
  const color = changes.color ?? current.color;

  if (
    data.categories.some(
      (c) => c.id !== id && c.name.toLowerCase() === name.toLowerCase(),
    )
  ) {
    throw new ValidationError(`A category called '${name}' already exists.`);
  }

  const used = data.transactions.some((tx) => tx.categoryId === id);
  if (kind !== current.kind && used) {
    throw new ValidationError(
      "This category already has transactions, so its type cannot change. Move the transactions first.",
    );
  }

  return {
    ...data,
    categories: data.categories.map((c) => (c.id === id ? { ...c, name, kind, color } : c)),
    planItems:
      kind === "income" ? data.planItems.filter((item) => item.categoryId !== id) : data.planItems,
  };
}

export function deleteCategory(
  data: LedgerData,
  id: string,
  moveTo?: string,
): LedgerData {
  const category = data.categories.find((c) => c.id === id);
  if (!category) throw new ValidationError("That category no longer exists.");

  const count = data.transactions.filter((tx) => tx.categoryId === id).length;
  if (count > 0 && !moveTo) {
    throw new ValidationError(
      `This category is used by ${count} ${count === 1 ? "transaction" : "transactions"}. Move them to another category first.`,
    );
  }

  let transactions = data.transactions;
  if (count > 0 && moveTo) {
    const destination = data.categories.find((c) => c.id === moveTo);
    if (!destination || destination.id === id) {
      throw new ValidationError("Choose a different category to move the transactions to.");
    }
    if (destination.kind !== category.kind) {
      throw new ValidationError("Transactions can only move to a category of the same type.");
    }
    transactions = data.transactions.map((tx) =>
      tx.categoryId === id ? { ...tx, categoryId: destination.id } : tx,
    );
  }

  return {
    ...data,
    categories: data.categories.filter((c) => c.id !== id),
    transactions,
    planItems: data.planItems.filter((item) => item.categoryId !== id),
  };
}

export interface TransactionInput {
  date: string;
  kind: string;
  amountCents: number;
  categoryId: string;
  note?: string;
  method?: string;
}

function checkCategoryKind(data: LedgerData, categoryId: string, kind: Kind): Category {
  const category = data.categories.find((c) => c.id === categoryId);
  if (!category) throw new ValidationError("That category no longer exists.");
  if (category.kind !== kind) {
    throw new ValidationError(
      `'${category.name}' is a ${category.kind} category, but this transaction is an ${kind}.`,
    );
  }
  return category;
}

function cleanCents(value: number): number {
  if (!Number.isInteger(value)) {
    throw new ValidationError("Amount must be a whole number of cents.");
  }
  if (value <= 0) throw new ValidationError("Amount must be greater than zero.");
  if (value > 10 ** 12) throw new ValidationError("That amount is too large.");
  return value;
}

export function addTransaction(data: LedgerData, input: TransactionInput): LedgerData {
  const date = parseDate(input.date);
  const kind = cleanKind(input.kind);
  const amountCents = cleanCents(input.amountCents);
  checkCategoryKind(data, input.categoryId, kind);

  const transaction: Transaction = {
    id: newId(),
    date,
    kind,
    amountCents,
    categoryId: input.categoryId,
    note: (input.note ?? "").trim().slice(0, 500),
    method: cleanMethod(input.method ?? "Card"),
  };
  return { ...data, transactions: [...data.transactions, transaction] };
}

export function updateTransaction(
  data: LedgerData,
  id: string,
  input: Partial<TransactionInput>,
): LedgerData {
  const current = data.transactions.find((tx) => tx.id === id);
  if (!current) throw new ValidationError("That transaction no longer exists.");

  const date = input.date !== undefined ? parseDate(input.date) : current.date;
  const kind = input.kind !== undefined ? cleanKind(input.kind) : current.kind;
  const amountCents =
    input.amountCents !== undefined ? cleanCents(input.amountCents) : current.amountCents;
  const categoryId = input.categoryId ?? current.categoryId;
  checkCategoryKind(data, categoryId, kind);

  const updated: Transaction = {
    ...current,
    date,
    kind,
    amountCents,
    categoryId,
    note: input.note !== undefined ? input.note.trim().slice(0, 500) : current.note,
    method: input.method !== undefined ? cleanMethod(input.method) : current.method,
  };
  return {
    ...data,
    transactions: data.transactions.map((tx) => (tx.id === id ? updated : tx)),
  };
}

export function deleteTransaction(data: LedgerData, id: string): LedgerData {
  return { ...data, transactions: data.transactions.filter((tx) => tx.id !== id) };
}

export function setPlanItem(
  data: LedgerData,
  categoryId: string,
  amount: string | number | null,
): LedgerData {
  const category = data.categories.find((c) => c.id === categoryId);
  if (!category) throw new ValidationError("That category no longer exists.");
  if (category.kind !== "expense") {
    throw new ValidationError("Only expense categories can be part of the plan.");
  }
  const amountCents = parsePlanAmount(amount);
  const others = data.planItems.filter((item) => item.categoryId !== categoryId);
  return {
    ...data,
    planItems: amountCents ? [...others, { categoryId, amountCents }] : others,
  };
}

export function savePlanSettings(
  data: LedgerData,
  input: {
    startingCents: string | number | null;
    months: string | number;
    incomeCents?: string | number | null;
    startYear?: number;
    startMonth?: number;
  },
): LedgerData {
  const startingCents = parsePlanAmount(input.startingCents);
  const incomeCents = parsePlanAmount(input.incomeCents ?? 0);
  const months = Number(input.months);
  if (!Number.isFinite(months) || months < 1) {
    throw new ValidationError("Choose how many months to plan for.");
  }
  if (months > MAX_PLAN_MONTHS) {
    throw new ValidationError(`Plan between 1 and ${MAX_PLAN_MONTHS} months ahead.`);
  }
  const now = new Date();
  const startYear = input.startYear ?? data.plan.startYear ?? now.getFullYear();
  const startMonth = input.startMonth ?? data.plan.startMonth ?? now.getMonth() + 1;
  const [year, month] =
    startMonth >= 1 && startMonth <= 12
      ? [startYear, startMonth]
      : [now.getFullYear(), now.getMonth() + 1];

  return {
    ...data,
    plan: {
      configured: true,
      startingCents,
      months: Math.round(months),
      incomeCents,
      startYear: year,
      startMonth: month,
    },
  };
}

export function clearPlan(data: LedgerData): LedgerData {
  const now = new Date();
  return {
    ...data,
    planItems: [],
    plan: {
      configured: false,
      startingCents: 0,
      months: DEFAULT_PLAN_MONTHS,
      incomeCents: 0,
      startYear: now.getFullYear(),
      startMonth: now.getMonth() + 1,
    },
  };
}

export function setAppearance(
  data: LedgerData,
  changes: Partial<Omit<Appearance, "language">> & { language?: string },
): LedgerData {
  return {
    ...data,
    appearance: {
      ...data.appearance,
      ...changes,
      language: normaliseLanguage(changes.language ?? data.appearance.language),
    },
  };
}

/** Parse and validate a value loaded from storage, filling in defaults. */
export function parseLedger(raw: unknown): LedgerData {
  const fallback = emptyLedger();
  if (!raw || typeof raw !== "object") return fallback;
  const source = raw as Partial<LedgerData>;

  const categories = Array.isArray(source.categories)
    ? source.categories
        .filter((c): c is Category => Boolean(c) && typeof c.id === "string")
        .map((c) => ({
          id: c.id,
          name: String(c.name ?? ""),
          kind: (c.kind === "income" ? "income" : "expense") as Kind,
          color: String(c.color ?? "#64748B"),
        }))
    : fallback.categories;

  const transactions = Array.isArray(source.transactions)
    ? source.transactions.filter(
        (tx): tx is Transaction =>
          Boolean(tx) &&
          typeof tx.id === "string" &&
          typeof tx.date === "string" &&
          typeof tx.amountCents === "number",
      )
    : [];

  const planItems = Array.isArray(source.planItems)
    ? source.planItems.filter(
        (item) => Boolean(item) && typeof item.categoryId === "string",
      )
    : [];

  const plan = {
    ...fallback.plan,
    ...(source.plan && typeof source.plan === "object" ? source.plan : {}),
  };
  plan.months = Math.max(1, Math.min(MAX_PLAN_MONTHS, Math.round(Number(plan.months) || 6)));

  const appearance = { ...fallback.appearance, ...(source.appearance ?? {}) };
  appearance.language = normaliseLanguage(appearance.language);

  return {
    version: DATA_VERSION,
    categories: categories.length ? categories : fallback.categories,
    transactions,
    planItems,
    plan,
    appearance,
  };
}

export function loadLedger(): LedgerData {
  if (typeof window === "undefined") return emptyLedger();
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      // A brand-new visitor gets the interface in their system language.
      const fresh = emptyLedger();
      fresh.appearance.language = systemLanguage();
      return fresh;
    }
    return parseLedger(JSON.parse(stored));
  } catch {
    return emptyLedger();
  }
}

export function saveLedger(data: LedgerData): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // A full or blocked storage must never break the interface.
  }
}

/** Rows to show in the spending table, already filtered and sorted. */
export function filterTransactions(
  data: LedgerData,
  options: {
    search?: string;
    kind?: Kind | null;
    categoryId?: string | null;
    start?: string | null;
    end?: string | null;
  } = {},
): Transaction[] {
  const term = (options.search ?? "").trim().toLowerCase();
  const categoryNames = new Map(data.categories.map((c) => [c.id, c.name]));

  return data.transactions
    .filter((tx) => {
      if (options.kind && tx.kind !== options.kind) return false;
      if (options.categoryId && tx.categoryId !== options.categoryId) return false;
      if (options.start && tx.date < options.start) return false;
      if (options.end && tx.date > options.end) return false;
      if (!term) return true;
      const haystack = [
        tx.note,
        tx.method,
        categoryNames.get(tx.categoryId) ?? "",
        String(tx.amountCents / 100),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    })
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id.localeCompare(a.id)));
}

export function exportCsv(transactions: readonly Transaction[], data: LedgerData): string {
  const byId = new Map(data.categories.map((c) => [c.id, c]));
  const header = ["Date", "Type", "Category", "Amount", "Method", "Note"];
  const rows = [...transactions]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((tx) => [
      tx.date,
      tx.kind === "income" ? "Income" : "Expense",
      byId.get(tx.categoryId)?.name ?? "",
      (tx.amountCents / 100).toFixed(2),
      tx.method,
      tx.note,
    ]);

  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  return [header, ...rows]
    .map((row) => row.map((cell) => escape(String(cell))).join(","))
    .join("\r\n");
}

export function amountFromInput(value: string): number {
  return parseAmount(value);
}

export { today };
