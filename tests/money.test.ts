import { describe, expect, it } from "vitest";

import {
  formatMoney,
  formatMoneyCompact,
  normaliseNumeric,
  parseAmount,
  parsePlanAmount,
} from "@/lib/money";

describe("parseAmount", () => {
  it("reads a plain decimal string", () => {
    expect(parseAmount("12.34")).toBe(1234);
    expect(parseAmount("12")).toBe(1200);
    expect(parseAmount("0.05")).toBe(5);
  });

  it("treats a comma as a decimal separator when two digits follow", () => {
    expect(parseAmount("12,50")).toBe(1250);
    expect(parseAmount("8,5")).toBe(850);
  });

  it("treats a comma as a thousands separator when three digits follow", () => {
    expect(parseAmount("1,234")).toBe(123400);
    expect(parseAmount("1,234.50")).toBe(123450);
  });

  it("ignores spaces, currency symbols and apostrophes", () => {
    expect(parseAmount("$ 40")).toBe(4000);
    expect(parseAmount("1 200")).toBe(120000);
    expect(parseAmount("1'200.75")).toBe(120075);
    expect(parseAmount("1\u00a0234,5")).toBe(123450);
  });

  it("reads a number as whole currency units", () => {
    expect(parseAmount(12)).toBe(1200);
    expect(parseAmount(12.34)).toBe(1234);
  });

  it("rounds half up", () => {
    expect(parseAmount("1.005")).toBe(101);
    expect(parseAmount("1.004")).toBe(100);
  });

  it("rejects empty, zero, negative and unreadable input", () => {
    expect(() => parseAmount("")).toThrow(/Enter an amount/);
    expect(() => parseAmount("abc")).toThrow(/not a valid amount/);
    expect(() => parseAmount("0")).toThrow(/greater than zero/);
    expect(() => parseAmount("-5")).toThrow(/greater than zero/);
    expect(() => parseAmount(Number.NaN)).toThrow(/Enter an amount/);
  });
});

describe("parsePlanAmount", () => {
  it("accepts zero for unused plan inputs", () => {
    expect(parsePlanAmount("")).toBe(0);
    expect(parsePlanAmount(null)).toBe(0);
    expect(parsePlanAmount("0")).toBe(0);
  });

  it("rejects negative amounts", () => {
    expect(() => parsePlanAmount("-10")).toThrow(/cannot be negative/);
  });

  it("parses the same shapes as parseAmount", () => {
    expect(parsePlanAmount("100 000")).toBe(10000000);
    expect(parsePlanAmount("12,50")).toBe(1250);
  });
});

describe("normaliseNumeric", () => {
  it("keeps a trailing two-digit group as decimals", () => {
    expect(normaliseNumeric("1,50")).toBe("1.50");
    expect(normaliseNumeric("1,234")).toBe("1234");
    expect(normaliseNumeric("1,234.50")).toBe("1234.50");
  });
});

describe("formatMoney", () => {
  it("prefixes the symbol by default", () => {
    expect(formatMoney(1234)).toBe("$12.34");
    expect(formatMoney(-1234)).toBe("-$12.34");
    expect(formatMoney(123456789)).toBe("$1,234,567.89");
  });

  it("suffixes the symbol for CZK and PLN", () => {
    expect(formatMoney(123450, "CZK")).toBe("1,234.50 K\u010d");
    expect(formatMoney(-500, "PLN")).toBe("-5.00 z\u0142");
  });

  it("keeps two decimals on whole amounts", () => {
    expect(formatMoney(100000)).toBe("$1,000.00");
    expect(formatMoney(0)).toBe("$0.00");
  });

  it("falls back to a readable label for unknown codes", () => {
    expect(formatMoney(100, "CHF")).toBe("CHF1.00");
  });
});

describe("formatMoneyCompact", () => {
  it("shortens thousands and millions", () => {
    expect(formatMoneyCompact(123000)).toBe("$1.2k");
    expect(formatMoneyCompact(200000000)).toBe("$2m");
    expect(formatMoneyCompact(85000)).toBe("$850");
    expect(formatMoneyCompact(340)).toBe("$3.40");
  });

  it("keeps the suffix order for CZK", () => {
    expect(formatMoneyCompact(123000, "CZK")).toBe("1.2k K\u010d");
  });
});
