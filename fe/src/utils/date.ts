// relativeTime.ts
type RelativeTimeStyle = "long" | "short" | "narrow";
type RelativeTimeNumeric = "always" | "auto";

export type FormatRelativeTimeOptions = {
  locale?: string | string[];
  style?: RelativeTimeStyle;
  numeric?: RelativeTimeNumeric;
  now?: Date | number;
};

const rtfCache = new Map<string, Intl.RelativeTimeFormat>();

function toDate(input: Date | number | string): Date {
  if (input instanceof Date) return input;

  const d =
    typeof input === "number" ? new Date(input) : new Date(Date.parse(input));

  if (Number.isNaN(d.getTime())) {
    throw new TypeError("formatRelativeTime: invalid date input");
  }

  return d;
}

function toNowMs(now: Date | number): number {
  return now instanceof Date ? now.getTime() : now;
}

/**
 * Format a date/time as a relative string like "3 minutes ago" / "in 2 days".
 */
export function formatRelativeTime(
  input: Date | number | string,
  options: FormatRelativeTimeOptions = {},
): string {
  const {
    locale,
    style = "long",
    numeric = "auto",
    now = Date.now(),
  } = options;

  const date = toDate(input);
  const diffMs = date.getTime() - toNowMs(now);

  const diffSeconds = diffMs / 1000;
  const absSeconds = Math.abs(diffSeconds);

  const units = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["week", 60 * 60 * 24 * 7],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
    ["second", 1],
  ] as const satisfies ReadonlyArray<
    readonly [Intl.RelativeTimeFormatUnit, number]
  >;

  let unit: Intl.RelativeTimeFormatUnit = "second";
  let unitSeconds = 1;

  for (const [u, seconds] of units) {
    if (absSeconds >= seconds || u === "second") {
      unit = u;
      unitSeconds = seconds;
      break;
    }
  }

  // Rounded to nearest whole unit (common UX choice).
  const value = Math.round(diffSeconds / unitSeconds);

  const cacheKey = JSON.stringify([locale ?? "default", style, numeric]);
  let rtf = rtfCache.get(cacheKey);
  if (!rtf) {
    rtf = new Intl.RelativeTimeFormat(locale, { style, numeric });
    rtfCache.set(cacheKey, rtf);
  }

  return rtf.format(value, unit);
}
