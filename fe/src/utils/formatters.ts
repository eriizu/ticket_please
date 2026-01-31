/**
 * Shared Intl.DateTimeFormat instances for consistent date/time formatting.
 * Using a single locale (en-IE) across the application.
 */

/** Formats as: "Monday, 15 January 2024 at 14:30" */
export const absoluteDateTimeFormatter = Intl.DateTimeFormat("en-IE", {
  dateStyle: "full",
  timeStyle: "short",
});

/** Formats as: "14:30" */
export const absoluteTimeFormatter = Intl.DateTimeFormat("en-IE", {
  timeStyle: "short",
});

/** Formats as: "Monday, 15 January 2024" */
export const absoluteDateFormatter = Intl.DateTimeFormat("en-IE", {
  dateStyle: "full",
});

const relativeTimeFormatter = new Intl.RelativeTimeFormat("en", {
  numeric: "auto",
});

/**
 * Formats a date relative to now if within 7 days, otherwise absolute.
 * Same-day dates include relative time in parentheses.
 * Examples:
 * - "today (in 2 hours)"
 * - "tomorrow"
 * - "in 3 days"
 * - "Monday, 15 January 2024 at 14:30" (if > 7 days)
 */
export function formatRelativeDateTime(date: Date | number): string {
  const targetDate = date instanceof Date ? date : new Date(date);
  const now = new Date();

  const diffMs = targetDate.getTime() - now.getTime();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  // Check if same calendar day
  const isSameDay =
    targetDate.getFullYear() === now.getFullYear() &&
    targetDate.getMonth() === now.getMonth() &&
    targetDate.getDate() === now.getDate();

  if (Math.abs(diffDays) > 7) {
    return absoluteDateTimeFormatter.format(targetDate);
  }

  const time = absoluteTimeFormatter.format(targetDate);

  if (isSameDay) {
    const relativeTime = relativeTimeFormatter.format(diffHours, "hour");
    return `today at ${time} (${relativeTime})`;
  }

  return `${relativeTimeFormatter.format(diffDays, "day")} at ${time}`;
}
