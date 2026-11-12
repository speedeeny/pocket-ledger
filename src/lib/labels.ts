import { t, type LanguageCode } from "./i18n";
import { DEFAULT_CATEGORIES } from "./types";

const SEEDED = new Set(DEFAULT_CATEGORIES.map(([name]) => name));

/**
 * Display name for a stored category.
 *
 * Categories created on first run are stored in English so stored data stays
 * stable, and those names are translated. A name the user typed is shown
 * exactly as typed, in both languages.
 */
export function categoryLabel(
  language: LanguageCode,
  name: string,
): string {
  return SEEDED.has(name) ? t(language, name) : name;
}
