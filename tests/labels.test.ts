import { describe, expect, it } from "vitest";

import { categoryLabel } from "@/lib/labels";

describe("categoryLabel", () => {
  it("translates the names seeded on first run", () => {
    expect(categoryLabel("cs", "Groceries")).toBe("Potraviny");
    expect(categoryLabel("cs", "Housing")).toBe("Bydlení");
    expect(categoryLabel("en", "Groceries")).toBe("Groceries");
  });

  it("leaves a name the user typed untouched in both languages", () => {
    expect(categoryLabel("cs", "Kavárna")).toBe("Kavárna");
    expect(categoryLabel("en", "My own category")).toBe("My own category");
  });

  it("only translates exact seeded names, not lookalikes", () => {
    expect(categoryLabel("cs", "groceries")).toBe("groceries");
    expect(categoryLabel("cs", "Groceries ")).toBe("Groceries ");
  });
});
