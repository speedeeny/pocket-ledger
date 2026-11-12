import {
  CATALOGUES,
  DEFAULT_LANGUAGE,
  LANGUAGES,
  MONTHS,
  WEEKDAYS,
} from "./catalogue";
import type { LanguageCode } from "./types";

export type { LanguageCode };
export { DEFAULT_LANGUAGE, LANGUAGES, MONTHS, WEEKDAYS };

export interface DateParts {
  year: number;
  month: number;
  day: number;
}

export function normaliseLanguage(code: unknown): LanguageCode {
  const raw = String(code ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
  if (!raw) return DEFAULT_LANGUAGE;
  const short = raw.split("-")[0];
  if (short in LANGUAGES) return short as LanguageCode;
  for (const known of Object.keys(LANGUAGES)) {
    if (raw.startsWith(known)) return known as LanguageCode;
  }
  return DEFAULT_LANGUAGE;
}

/** Guess the language from the browser, e.g. "cs-CZ" -> "cs". */
export function systemLanguage(): LanguageCode {
  if (typeof navigator === "undefined") return DEFAULT_LANGUAGE;
  const candidates = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];
  for (const candidate of candidates) {
    if (candidate) return normaliseLanguage(candidate);
  }
  return DEFAULT_LANGUAGE;
}

export function languageName(code: LanguageCode | null = null): string {
  return LANGUAGES[normaliseLanguage(code ?? DEFAULT_LANGUAGE)];
}

export function catalogue(code: LanguageCode = DEFAULT_LANGUAGE): Record<string, string> {
  return CATALOGUES[normaliseLanguage(code)];
}

/** Czech plural rule: 1 / 2-4 / everything else. */
function pluralIndex(count: number): number {
  if (count === 1) return 0;
  if (count >= 2 && count <= 4) return 1;
  return 2;
}

function fill(template: string, values: readonly unknown[]): string {
  let next = 0;
  return template.replace(/\{(\d*)\}/g, (match, indexText: string) => {
    const index = indexText === "" ? next++ : Number(indexText);
    return index < values.length ? String(values[index]) : match;
  });
}

/**
 * Translate an English interface string into the active language.
 * Unknown strings pass through unchanged, and a bad placeholder never throws.
 */
export function t(
  language: LanguageCode,
  text: string,
  ...values: readonly unknown[]
): string {
  let translated = catalogue(language)[text] ?? text;
  if (translated.includes("|")) {
    const forms = translated.split("|");
    const count = typeof values[0] === "number" ? (values[0] as number) : 0;
    translated = forms[Math.min(pluralIndex(count), forms.length - 1)];
  }
  if (!values.length) return translated;
  try {
    return fill(translated, values);
  } catch {
    return translated;
  }
}

/** Pick the singular or plural English key, then translate with the count. */
export function tn(language: LanguageCode, count: number, one: string, many: string): string {
  return t(language, count === 1 ? one : many, count);
}

export function monthName(language: LanguageCode, month: number, short = false): string {
  const names = MONTHS[language] ?? MONTHS[DEFAULT_LANGUAGE];
  const full = names[(((month - 1) % 12) + 12) % 12];
  return short ? full.slice(0, 3) : full;
}

export function monthLabel(language: LanguageCode, year: number, month: number): string {
  return `${monthName(language, month)} ${year}`;
}

export function formatDate(language: LanguageCode, iso: string): string {
  const { year, month, day } = splitIso(iso);
  if (language === "cs") return `${day}. ${month}. ${year}`;
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

export function weekdayName(language: LanguageCode, index: number, short = true): string {
  const names = WEEKDAYS[language] ?? WEEKDAYS[DEFAULT_LANGUAGE];
  const full = names[((index % 7) + 7) % 7];
  return short ? full.slice(0, 3) : full;
}

export function formatDayMonth(
  language: LanguageCode,
  iso: string,
  weekday = false,
): string {
  const { year, month, day } = splitIso(iso);
  const text =
    language === "cs"
      ? `${day}. ${month}.`
      : `${day} ${monthName(language, month, true)}`;
  if (!weekday) return text;
  const weekdayIndex = (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
  return `${weekdayName(language, weekdayIndex)} ${text}`;
}

function splitIso(iso: string): DateParts {
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month, day };
}

/** Display name for a stored payment method (``Card`` -> ``Karta``). */
export function methodLabel(language: LanguageCode, value: string): string {
  return value ? t(language, value) : value;
}
