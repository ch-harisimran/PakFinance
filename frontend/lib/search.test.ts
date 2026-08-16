import { describe, expect, it } from "vitest";
import { matches, filterBy, readQuery } from "@/lib/search";

describe("matches", () => {
  it("matches a substring, case-insensitively", () => {
    expect(matches("meez", "Meezan Bank")).toBe(true);
    expect(matches("MEEZAN", "Meezan Bank")).toBe(true);
  });

  it("requires every word, in any field and any order", () => {
    // "meezan car" should find the car loan from Meezan Bank, where the two
    // words live in different columns.
    expect(matches("meezan car", "Car loan", "Meezan Bank")).toBe(true);
    expect(matches("car meezan", "Car loan", "Meezan Bank")).toBe(true);
    expect(matches("meezan house", "Car loan", "Meezan Bank")).toBe(false);
  });

  it("ignores accents", () => {
    expect(matches("cafe", "Café bill")).toBe(true);
  });

  it("skips null and undefined fields", () => {
    expect(matches("rent", "Rent", null, undefined)).toBe(true);
  });

  it("searches numbers too, for account digits", () => {
    expect(matches("4471", "Meezan Bank", 4471)).toBe(true);
  });

  it("treats an empty query as matching everything", () => {
    expect(matches("", "anything")).toBe(true);
    expect(matches("   ", "anything")).toBe(true);
  });
});

describe("filterBy", () => {
  const rows = [
    { name: "Car loan", lender: "Meezan Bank" },
    { name: "Home loan", lender: "HBL" },
    { name: "Phone instalment", lender: null },
  ];

  it("returns everything for an empty query, without copying needlessly", () => {
    expect(filterBy(rows, "", (r) => [r.name, r.lender])).toBe(rows);
  });

  it("narrows to matching rows", () => {
    const out = filterBy(rows, "loan", (r) => [r.name, r.lender]);
    expect(out.map((r) => r.name)).toEqual(["Car loan", "Home loan"]);
  });

  it("returns nothing when nothing matches", () => {
    expect(filterBy(rows, "zzz", (r) => [r.name])).toEqual([]);
  });
});

describe("readQuery", () => {
  it("reads a plain string param", () => {
    expect(readQuery("rent")).toBe("rent");
  });

  it("trims, so a stray space does not filter everything out", () => {
    expect(readQuery("  rent  ")).toBe("rent");
  });

  it("takes the first when a param repeats", () => {
    expect(readQuery(["rent", "fuel"])).toBe("rent");
  });

  it("treats a missing param as no filter", () => {
    expect(readQuery(undefined)).toBe("");
  });
});
