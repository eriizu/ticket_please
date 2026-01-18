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
