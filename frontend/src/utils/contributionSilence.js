/**
 * Contribution silence-period logic.
 *
 * Business rule (dollar-for-day):
 *   silence_days = floor(amount)
 *
 *   $1    → 1 day
 *   $10   → 10 days
 *   $25   → 25 days
 *   $100  → 100 days
 *   $0.50 → 0 days (no silence)
 *   never paid → 0 days
 *
 * The larger the contribution, the longer we stay quiet before asking again.
 */

/**
 * Number of days the popup/banner should stay silenced after paying `amount`.
 * Returns 0 for falsy, non-numeric, or sub-$1 amounts.
 */
export const getSilenceDays = (amount) => {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
};

/**
 * Most-recent timestamp (ms) among the provided ISO dates. Null if none.
 */
const latestTs = (...dates) => {
  const ts = dates
    .filter(Boolean)
    .map((d) => new Date(d).getTime())
    .filter((n) => Number.isFinite(n));
  return ts.length ? Math.max(...ts) : null;
};

/**
 * True if the user is currently inside the silence window.
 */
export const isSilenceActive = (lastContributionDate, lastRecurringPaymentDate, lastAmount) => {
  const latest = latestTs(lastContributionDate, lastRecurringPaymentDate);
  if (latest === null) return false; // never paid
  const silenceDays = getSilenceDays(lastAmount);
  if (silenceDays <= 0) return false;
  const daysSince = (Date.now() - latest) / (1000 * 60 * 60 * 24);
  return daysSince < silenceDays;
};

/**
 * Remaining silence days (rounded up). 0 if silence is not active.
 * Useful for debug logs / admin displays.
 */
export const silenceDaysRemaining = (lastContributionDate, lastRecurringPaymentDate, lastAmount) => {
  const latest = latestTs(lastContributionDate, lastRecurringPaymentDate);
  if (latest === null) return 0;
  const silenceDays = getSilenceDays(lastAmount);
  if (silenceDays <= 0) return 0;
  const daysSince = (Date.now() - latest) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.ceil(silenceDays - daysSince));
};
