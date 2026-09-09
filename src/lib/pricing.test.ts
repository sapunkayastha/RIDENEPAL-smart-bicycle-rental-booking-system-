import { describe, it, expect } from "vitest";
import {
  calculateBookingDays,
  calculateBookingTotal,
  calculateCommissionSplit,
  calculateExtendedWindow,
  applyVendorApprovalBump,
} from "./pricing";

describe("calculateBookingDays", () => {
  it("returns 1 for a booking under 24 hours", () => {
    const start = new Date("2026-01-01T10:00:00Z");
    const end = new Date("2026-01-01T18:00:00Z");
    expect(calculateBookingDays(start, end)).toBe(1);
  });

  it("rounds up partial days (e.g. 25 hours = 2 days)", () => {
    const start = new Date("2026-01-01T10:00:00Z");
    const end = new Date("2026-01-02T11:00:00Z");
    expect(calculateBookingDays(start, end)).toBe(2);
  });

  it("handles exact multi-day spans correctly", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const end = new Date("2026-01-08T00:00:00Z");
    expect(calculateBookingDays(start, end)).toBe(7);
  });

  it("rejects an end date before the start date", () => {
    const start = new Date("2026-01-05T00:00:00Z");
    const end = new Date("2026-01-01T00:00:00Z");
    expect(() => calculateBookingDays(start, end)).toThrow("Invalid rental dates");
  });

  it("rejects an end date equal to the start date", () => {
    const same = new Date("2026-01-05T00:00:00Z");
    expect(() => calculateBookingDays(same, same)).toThrow("Invalid rental dates");
  });

  it("rejects invalid Date objects", () => {
    expect(() => calculateBookingDays(new Date("not a date"), new Date())).toThrow(
      "Invalid rental dates",
    );
  });
});

describe("calculateBookingTotal", () => {
  it("multiplies price per day by number of days", () => {
    expect(calculateBookingTotal(250, 3)).toBe(750);
  });

  it("handles a single day booking", () => {
    expect(calculateBookingTotal(450, 1)).toBe(450);
  });

  it("rounds to 2 decimal places", () => {
    expect(calculateBookingTotal(99.995, 3)).toBe(299.99);
  });

  it("rejects a zero or negative price", () => {
    expect(() => calculateBookingTotal(0, 3)).toThrow("Invalid price");
    expect(() => calculateBookingTotal(-100, 3)).toThrow("Invalid price");
  });

  it("rejects zero or negative days", () => {
    expect(() => calculateBookingTotal(250, 0)).toThrow("Invalid duration");
    expect(() => calculateBookingTotal(250, -1)).toThrow("Invalid duration");
  });
});

describe("calculateCommissionSplit", () => {
  it("splits a booking at the default 15% rate", () => {
    const { commission, payout } = calculateCommissionSplit(1000, 15);
    expect(commission).toBe(150);
    expect(payout).toBe(850);
  });

  it("commission and payout always add back up to the total", () => {
    const { commission, payout } = calculateCommissionSplit(1650, 15);
    expect(Math.round((commission + payout) * 100) / 100).toBe(1650);
  });

  it("handles a 0% commission rate", () => {
    const { commission, payout } = calculateCommissionSplit(500, 0);
    expect(commission).toBe(0);
    expect(payout).toBe(500);
  });

  it("handles a 100% commission rate", () => {
    const { commission, payout } = calculateCommissionSplit(500, 100);
    expect(commission).toBe(500);
    expect(payout).toBe(0);
  });

  it("rejects a negative total", () => {
    expect(() => calculateCommissionSplit(-100, 15)).toThrow("Invalid total amount");
  });

  it("rejects an out-of-range commission rate", () => {
    expect(() => calculateCommissionSplit(1000, -5)).toThrow("Invalid commission rate");
    expect(() => calculateCommissionSplit(1000, 150)).toThrow("Invalid commission rate");
  });
});

describe("calculateExtendedWindow", () => {
  it("preserves the original rental duration when pushed forward", () => {
    const oldStart = new Date("2026-01-01T10:00:00Z");
    const oldEnd = new Date("2026-01-04T10:00:00Z"); // 3-day booking
    const now = new Date("2026-01-01T14:00:00Z"); // 4 hours late
    const { newStart, newEnd } = calculateExtendedWindow(oldStart, oldEnd, now);
    expect(newStart).toEqual(now);
    const durationMs = newEnd.getTime() - newStart.getTime();
    expect(durationMs).toBe(oldEnd.getTime() - oldStart.getTime());
  });

  it("rejects a booking whose end is not after its start", () => {
    const same = new Date("2026-01-01T10:00:00Z");
    expect(() => calculateExtendedWindow(same, same, new Date())).toThrow(
      "Invalid original booking window",
    );
  });
});

describe("applyVendorApprovalBump", () => {
  it("adds one percentage point by default", () => {
    expect(applyVendorApprovalBump(15)).toBe(16);
  });

  it("never exceeds the cap", () => {
    expect(applyVendorApprovalBump(49.5)).toBe(50);
    expect(applyVendorApprovalBump(50)).toBe(50);
  });

  it("supports a custom step and cap", () => {
    expect(applyVendorApprovalBump(10, 5, 30)).toBe(15);
    expect(applyVendorApprovalBump(28, 5, 30)).toBe(30);
  });
});
