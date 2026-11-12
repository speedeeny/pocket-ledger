export type Kind = "expense" | "income";

export type PlanStatus = "short" | "tight" | "ok" | "unset";

export interface Category {
  id: string;
  name: string;
  kind: Kind;
  color: string;
}

export interface Transaction {
  id: string;
  date: string;
  kind: Kind;
  amountCents: number;
  categoryId: string;
  note: string;
  method: string;
}

export interface PlanItem {
  categoryId: string;
  amountCents: number;
}

export interface PlanSettings {
  configured: boolean;
  startingCents: number;
  months: number;
  incomeCents: number;
  startYear: number;
  startMonth: number;
}

export interface Appearance {
  language: LanguageCode;
  mode: "light" | "dark";
  palette: PaletteName;
  currency: string;
}

export type LanguageCode = "en" | "cs";

export type PaletteName = "emerald" | "ocean" | "violet" | "amber" | "rose";

export interface LedgerData {
  version: number;
  categories: Category[];
  transactions: Transaction[];
  planItems: PlanItem[];
  plan: PlanSettings;
  appearance: Appearance;
}

export interface MonthState {
  year: number;
  month: number;
  incomeCents: number;
  fixedCents: number;
  freeCents: number;
  fixedSpentCents: number;
  freeSpentCents: number;
  balanceCents: number;
  started: boolean;
}

export interface BudgetPlan {
  configured: boolean;
  startingCents: number;
  months: number;
  incomeCents: number;
  startYear: number;
  startMonth: number;
  items: PlanItem[];
  schedule: MonthState[];
  currentYear: number;
  currentMonth: number;
}

export const KINDS: readonly Kind[] = ["expense", "income"] as const;

export const METHODS = [
  "Card",
  "Cash",
  "Bank transfer",
  "Direct debit",
  "Other",
] as const;

export const DEFAULT_PLAN_MONTHS = 6;
export const MAX_PLAN_MONTHS = 60;

export const CATEGORY_COLORS = [
  "#F97316",
  "#22C55E",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#0EA5E9",
  "#EAB308",
  "#14B8A6",
  "#EF4444",
  "#64748B",
] as const;

export const DEFAULT_CATEGORIES: ReadonlyArray<
  readonly [string, Kind, string]
> = [
  ["Food & Drink", "expense", "#F97316"],
  ["Groceries", "expense", "#22C55E"],
  ["Transport", "expense", "#3B82F6"],
  ["Housing", "expense", "#8B5CF6"],
  ["Utilities", "expense", "#0EA5E9"],
  ["Health", "expense", "#EF4444"],
  ["Shopping", "expense", "#EC4899"],
  ["Entertainment", "expense", "#EAB308"],
  ["Other", "expense", "#64748B"],
  ["Salary", "income", "#16A34A"],
  ["Freelance", "income", "#0891B2"],
  ["Other income", "income", "#64748B"],
];
