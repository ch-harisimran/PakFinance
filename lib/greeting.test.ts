import { describe, expect, it } from "vitest";
import { greetingFor, karachiHour, type Greeting } from "@/lib/greeting";

describe("greetingFor", () => {
  it("covers all 24 hours with no gaps", () => {
    for (let h = 0; h < 24; h++) expect(typeof greetingFor(h)).toBe("string");
  });

  it("maps every hour to the right band", () => {
    const expected: [number, Greeting][] = [
      [0, "Good night"], [1, "Good night"], [2, "Good night"],
      [3, "Good morning"], [7, "Good morning"], [11, "Good morning"],
      [12, "Good afternoon"], [15, "Good afternoon"], [16, "Good afternoon"],
      [17, "Good evening"], [18, "Good evening"], [19, "Good evening"],
      [20, "Good night"], [23, "Good night"],
    ];
    for (const [hour, want] of expected) expect(greetingFor(hour)).toBe(want);
  });

  /** Every boundary, from both sides — this is where an off-by-one hides. */
  it.each([
    [2, "Good night"], [3, "Good morning"],
    [11, "Good morning"], [12, "Good afternoon"],
    [16, "Good afternoon"], [17, "Good evening"],
    [19, "Good evening"], [20, "Good night"],
  ] as [number, Greeting][])("hour %i is %s", (hour, want) => {
    expect(greetingFor(hour)).toBe(want);
  });

  /**
   * The band that wraps midnight. 23:00 and 01:00 are hours apart in clock
   * arithmetic but belong to the same night, and a naive
   * `hour >= 20 && hour < 3` would be false for both.
   */
  it("treats 20:00 and 02:00 as the same night", () => {
    expect(greetingFor(20)).toBe("Good night");
    expect(greetingFor(2)).toBe("Good night");
    expect(greetingFor(23)).toBe(greetingFor(1));
  });

  it("never says good morning at 2am", () => {
    // The old three-band version did exactly this.
    expect(greetingFor(2)).not.toBe("Good morning");
  });

  it("falls back to the night for a non-finite hour", () => {
    expect(greetingFor(NaN)).toBe("Good night");
  });
});

describe("karachiHour", () => {
  it("reads the hour in Karachi, not the machine's zone", () => {
    // 09:00 UTC is 14:00 in Karachi (UTC+5) — afternoon, not morning.
    const at = new Date("2026-08-18T09:00:00Z");
    expect(karachiHour(at)).toBe(14);
    expect(greetingFor(karachiHour(at))).toBe("Good afternoon");
  });

  it("rolls the date correctly across UTC midnight", () => {
    // 21:00 UTC is 02:00 the NEXT day in Karachi — still the night band.
    const at = new Date("2026-08-18T21:00:00Z");
    expect(karachiHour(at)).toBe(2);
    expect(greetingFor(karachiHour(at))).toBe("Good night");
  });

  it("returns an hour in range for every hour of a UTC day", () => {
    for (let h = 0; h < 24; h++) {
      const at = new Date(Date.UTC(2026, 7, 18, h));
      const hour = karachiHour(at);
      expect(hour).toBeGreaterThanOrEqual(0);
      expect(hour).toBeLessThanOrEqual(23);
    }
  });
});
