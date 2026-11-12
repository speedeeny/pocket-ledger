import { describe, expect, it } from "vitest";

import { addMonths, monthBounds, parseDate, toIso } from "@/lib/dates";
import {
  formatDate,
  formatDayMonth,
  monthLabel,
  normaliseLanguage,
  t,
  tn,
  systemLanguage,
} from "@/lib/i18n";

describe("dates", () => {
  it("parses the accepted shapes", () => {
    expect(parseDate("2026-10-23")).toBe("2026-10-23");
    expect(parseDate("2026/10/23")).toBe("2026-10-23");
    expect(parseDate("2026.1.5")).toBe("2026-01-05");
  });

  it("rejects impossible dates", () => {
    expect(() => parseDate("2026-02-30")).toThrow(/not a valid date/);
    expect(() => parseDate("2026-13-01")).toThrow(/not a valid date/);
    expect(() => parseDate("")).toThrow(/Enter a date/);
    expect(() => parseDate("nonsense")).toThrow(/YYYY-MM-DD/);
  });

  it("accepts a leap day", () => {
    expect(parseDate("2024-02-29")).toBe("2024-02-29");
    expect(() => parseDate("2026-02-29")).toThrow(/not a valid date/);
  });

  it("shifts months across year boundaries", () => {
    expect(addMonths(2026, 12, 1)).toEqual([2027, 1]);
    expect(addMonths(2026, 1, -1)).toEqual([2025, 12]);
    expect(addMonths(2026, 10, 6)).toEqual([2027, 4]);
  });

  it("computes inclusive month bounds", () => {
    expect(monthBounds(2026, 10)).toEqual(["2026-10-01", "2026-10-31"]);
    expect(monthBounds(2026, 2)).toEqual(["2026-02-01", "2026-02-28"]);
    expect(monthBounds(2024, 2)).toEqual(["2024-02-01", "2024-02-29"]);
    expect(monthBounds(2026, 12)).toEqual(["2026-12-01", "2026-12-31"]);
  });

  it("pads single digits", () => {
    expect(toIso(2026, 1, 5)).toBe("2026-01-05");
  });
});

describe("i18n", () => {
  it("normalises locale strings", () => {
    expect(normaliseLanguage("cs-CZ")).toBe("cs");
    expect(normaliseLanguage("cs_CZ")).toBe("cs");
    expect(normaliseLanguage("en-GB")).toBe("en");
    expect(normaliseLanguage("de-DE")).toBe("en");
    expect(normaliseLanguage(undefined)).toBe("en");
  });

  it("translates a known key and passes unknown ones through", () => {
    expect(t("cs", "Save")).toBe("Ulo\u017eit");
    expect(t("en", "Save")).toBe("Save");
    expect(t("cs", "Not in the catalogue")).toBe("Not in the catalogue");
  });

  it("fills numbered placeholders", () => {
    expect(t("cs", "Backup saved to {}", "/tmp/a.db")).toBe(
      "Z\u00e1loha ulo\u017eena do /tmp/a.db",
    );
    expect(t("en", "Show {}", 5)).toBe("Show 5");
  });

  it("never throws on a mismatched placeholder", () => {
    expect(t("cs", "Show {0} and {1}", "only-one")).toBeTruthy();
  });

  it("uses Czech plural forms", () => {
    const key = "{} months already running";
    expect(t("cs", key, 1)).toBe("1 m\u011bs\u00edc u\u017e b\u011b\u017e\u00ed");
    expect(t("cs", key, 3)).toBe("3 m\u011bs\u00edce u\u017e b\u011b\u017e\u00ed");
    expect(t("cs", key, 7)).toBe("7 m\u011bs\u00edc\u016f u\u017e b\u011b\u017e\u00ed");
  });

  it("picks singular and plural English keys", () => {
    expect(tn("en", 1, "{} entry", "{} entries")).toBe("1 entry");
    expect(tn("en", 2, "{} entry", "{} entries")).toBe("2 entries");
  });

  it("formats dates per language", () => {
    expect(formatDate("en", "2026-10-23")).toBe("23/10/2026");
    expect(formatDate("cs", "2026-10-23")).toBe("23. 10. 2026");
    expect(formatDayMonth("en", "2026-10-23")).toBe("23 Oct");
    expect(formatDayMonth("cs", "2026-10-23")).toBe("23. 10.");
    expect(formatDayMonth("en", "2026-10-23", true)).toBe("Fri 23 Oct");
    expect(monthLabel("cs", 2026, 10)).toBe("\u0158\u00edjen 2026");
  });

  it("guesses the language from the runtime locale", () => {
    // Node exposes the OS locale through navigator; a browser does the same
    // with the user's preferred languages.
    expect(["en", "cs"]).toContain(systemLanguage());
  });
});
