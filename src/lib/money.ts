import { ValidationError } from "./errors";

export interface Currency {
  code: string;
  symbol: string;
  name: string;
  suffix?: boolean;
}

export const CURRENCIES: readonly Currency[] = [
  { code: "USD", symbol: "$", name: "US dollar" },
  { code: "EUR", symbol: "\u20ac", name: "Euro" },
  { code: "GBP", symbol: "\u00a3", name: "British pound" },
  { code: "CZK", symbol: "K\u010d", name: "Czech koruna", suffix: true },
  { code: "PLN", symbol: "z\u0142", name: "Polish z\u0142oty", suffix: true },
  { code: "JPY", symbol: "\u00a5", name: "Japanese yen" },
  { code: "INR", symbol: "\u20b9", name: "Indian rupee" },
];

export const DEFAULT_CURRENCY = "USD";

export function resolveCurrency(value?: string | null): Currency {
  const text = (value ?? "").trim();
  if (!text) return CURRENCIES[0];
  const code = text.toUpperCase();
  const found = CURRENCIES.find((c) => c.code === code || c.symbol === text);
  if (found) return found;
  return { code: code.slice(0, 8) || "USD", symbol: text, name: "Custom currency" };
}

/** Groups the integer part with commas, always two decimals: 1234567 -> 12,345.67 */
function groupCents(cents: number): string {
  const whole = Math.floor(cents / 100);
  const fraction = String(cents % 100).padStart(2, "0");
  return `${String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction}`;
}

/** Format integer cents, e.g. -1234 -> "-$12.34" or "1,234.50 Kč". */
export function formatMoney(cents: number, currency: string = DEFAULT_CURRENCY): string {
  const option = resolveCurrency(currency);
  const sign = cents < 0 ? "-" : "";
  const amount = groupCents(Math.abs(Math.round(cents)));
  return option.suffix
    ? `${sign}${amount} ${option.symbol}`
    : `${sign}${option.symbol}${amount}`;
}

/** Short money label: $1.2k, $850, $3.40, 1.2k Kč. */
export function formatMoneyCompact(
  cents: number,
  currency: string = DEFAULT_CURRENCY,
): string {
  const option = resolveCurrency(currency);
  const value = Math.abs(cents) / 100;
  const sign = cents < 0 ? "-" : "";
  let text: string;
  if (value >= 1_000_000) {
    text = `${(value / 1_000_000).toFixed(1)}m`.replace(".0m", "m");
  } else if (value >= 1_000) {
    text = `${(value / 1_000).toFixed(1)}k`.replace(".0k", "k");
  } else if (value >= 100) {
    text = Math.round(value).toLocaleString("en-US");
  } else if (value === Math.trunc(value)) {
    text = String(Math.trunc(value));
  } else {
    text = value.toFixed(2);
  }
  return option.suffix ? `${sign}${text} ${option.symbol}` : `${sign}${option.symbol}${text}`;
}

/**
 * Turn user input such as "1,234.50", "12,50" or "$ 40" into "1234.50".
 * Comma is read as a decimal separator only when it is followed by one or two
 * digits; otherwise it groups thousands.
 */
export function normaliseNumeric(text: string): string {
  let cleaned = text
    .replace(/[\s\u00a0']/g, "")
    .replace(/[^\d.,-]/g, "");
  if (!cleaned) return "";
  if (cleaned.includes(",") && cleaned.includes(".")) {
    cleaned = cleaned.replace(/,/g, "");
  } else if (cleaned.includes(",")) {
    const head = cleaned.slice(0, cleaned.lastIndexOf(","));
    const tail = cleaned.slice(cleaned.lastIndexOf(",") + 1);
    cleaned = /^\d{1,2}$/.test(tail)
      ? `${head.replace(/,/g, "")}.${tail}`
      : cleaned.replace(/,/g, "");
  }
  return cleaned;
}

/**
 * Parse a human amount into integer cents, rounding half up.
 * A number is read as whole currency units (12 -> 1200), a string as typed.
 */
export function parseAmount(value: string | number): number {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new ValidationError("Enter an amount.");
    const cents = Math.round(value * 100);
    if (cents <= 0) throw new ValidationError("Amount must be greater than zero.");
    return cents;
  }

  const raw = String(value ?? "").trim();
  if (!raw) throw new ValidationError("Enter an amount.");
  const cleaned = normaliseNumeric(raw);
  if (!cleaned) throw new ValidationError(`'${raw}' is not a valid amount.`);

  const match = /^(-?)(\d*)(?:\.(\d*))?$/.exec(cleaned);
  if (!match || (!match[2] && !match[3])) {
    throw new ValidationError(`'${raw}' is not a valid amount.`);
  }

  const negative = match[1] === "-";
  const whole = match[2] || "0";
  const fraction = (match[3] ?? "").padEnd(3, "0");
  let cents = Number(whole) * 100 + Number(fraction.slice(0, 2));
  if (Number(fraction[2]) >= 5) cents += 1; // half up, exactly like Decimal
  if (negative) cents = -cents;

  if (cents <= 0) throw new ValidationError("Amount must be greater than zero.");
  if (cents > 10 ** 14) throw new ValidationError("That amount is too large.");
  return cents;
}

/** Parse money where zero is allowed (plan inputs). */
export function parsePlanAmount(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new ValidationError("Enter the amount as a number.");
    const cents = Math.round(value * 100);
    if (cents < 0) throw new ValidationError("The amount cannot be negative.");
    return cents;
  }

  const text = value.trim();
  if (!text) return 0;
  const cleaned = normaliseNumeric(text);
  if (!cleaned) throw new ValidationError("Enter the amount as a number.");

  const match = /^(-?)(\d*)(?:\.(\d*))?$/.exec(cleaned);
  if (!match || (!match[2] && !match[3])) {
    throw new ValidationError("Enter the amount as a number.");
  }
  const whole = match[2] || "0";
  const fraction = (match[3] ?? "").padEnd(3, "0");
  let cents = Number(whole) * 100 + Number(fraction.slice(0, 2));
  if (Number(fraction[2]) >= 5) cents += 1;
  if (match[1] === "-") cents = -cents;
  if (cents < 0) throw new ValidationError("The amount cannot be negative.");
  if (cents > 10 ** 14) throw new ValidationError("That amount is too large.");
  return cents;
}
