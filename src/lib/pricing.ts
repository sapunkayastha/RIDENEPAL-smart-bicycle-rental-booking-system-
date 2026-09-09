// Pure, DB-free business logic — kept separate specifically so it can
// be unit tested in isolation from the database and HTTP layers.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Number of whole rental days between two dates, minimum 1. */
export function calculateBookingDays(start: Date, end: Date): number {
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
    throw new Error("Invalid rental dates");
  }
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / MS_PER_DAY));
}

/** Total price for a booking given a daily rate and number of days. */
export function calculateBookingTotal(pricePerDay: number, days: number): number {
  if (pricePerDay <= 0) throw new Error("Invalid price");
  if (days < 1) throw new Error("Invalid duration");
  return Math.round(pricePerDay * days * 100) / 100;
}

/**
 * Splits a paid booking's total between the platform and whoever the
 * bike belongs to, using the current commission rate (as a percentage,
 * e.g. 15 = 15%). Always applies the same rate regardless of whether
 * the bike is vendor-listed or platform-owned.
 */
export function calculateCommissionSplit(
  total: number,
  ratePercent: number,
): { commission: number; payout: number } {
  if (total < 0) throw new Error("Invalid total amount");
  if (ratePercent < 0 || ratePercent > 100) throw new Error("Invalid commission rate");
  const commission = Math.round(total * (ratePercent / 100) * 100) / 100;
  const payout = Math.round((total - commission) * 100) / 100;
  return { commission, payout };
}

/**
 * If a booking's pickup window has passed without the customer
 * checking in, this computes the pushed-forward window that preserves
 * the original rental duration, starting from "now".
 */
export function calculateExtendedWindow(
  oldStart: Date,
  oldEnd: Date,
  now: Date,
): { newStart: Date; newEnd: Date } {
  const durationMs = oldEnd.getTime() - oldStart.getTime();
  if (durationMs <= 0) throw new Error("Invalid original booking window");
  return { newStart: now, newEnd: new Date(now.getTime() + durationMs) };
}

/**
 * Applies the +1 percentage point auto-bump used whenever a new
 * vendor is approved, capped so it can never run away indefinitely.
 */
export function applyVendorApprovalBump(currentRate: number, step = 1, cap = 50): number {
  return Math.min(currentRate + step, cap);
}
