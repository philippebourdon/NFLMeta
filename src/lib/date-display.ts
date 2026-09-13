const MEDIUM_UTC_DATE = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "UTC",
});

/**
 * Format a database date without allowing malformed source data to crash a
 * server-rendered page. PostgreSQL can also return special date values such as
 * `infinity`; those are treated as unavailable rather than passed to Intl.
 */
export function formatUtcDate(value: string | Date | null | undefined, fallback = "-"): string {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? MEDIUM_UTC_DATE.format(value) : fallback;
  }

  const text = value?.trim();
  if (!text) return fallback;

  const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T00:00:00Z` : text);
  return Number.isFinite(parsed.getTime()) ? MEDIUM_UTC_DATE.format(parsed) : fallback;
}
