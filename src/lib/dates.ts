import { ValidationError } from "./errors";

export interface DateParts {
  year: number;
  month: number;
  day: number;
}

/** Local calendar date as YYYY-MM-DD, without timezone drift. */
export function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
}

export function parseDate(value: string): string {
  const text = String(value ?? "").trim();
  if (!text) throw new ValidationError("Enter a date (YYYY-MM-DD).");
  const cleaned = text.replace(/[/.]/g, "-");
  const parts = cleaned.split("-");
  if (parts.length === 3 && parts.every((part) => /^\d+$/.test(part))) {
    const [year, month, day] = parts.map(Number);
    if (isValidDate(year, month, day)) return toIso(year, month, day);
    throw new ValidationError(`'${text}' is not a valid date.`);
  }
  throw new ValidationError(`Use YYYY-MM-DD for dates (got '${text}').`);
}

export function isValidDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  return day <= daysInMonth(year, month);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function toIso(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(
    day,
  ).padStart(2, "0")}`;
}

export function splitDate(iso: string): DateParts {
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month, day };
}

/** Shift a (year, month) pair by delta months. */
export function addMonths(year: number, month: number, delta: number): [number, number] {
  const total = year * 12 + (month - 1) + delta;
  return [Math.floor(total / 12), (total % 12) + 1];
}

/** Inclusive first and last day of a month, as ISO strings. */
export function monthBounds(year: number, month: number): [string, string] {
  return [toIso(year, month, 1), toIso(year, month, daysInMonth(year, month))];
}

export function monthKeyOf(iso: string): string {
  return iso.slice(0, 7);
}

/** Month of a transaction date, as [year, month]. */
export function monthOf(iso: string): [number, number] {
  const { year, month } = splitDate(iso);
  return [year, month];
}

export function compareIso(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
