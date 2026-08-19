const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;

export function formatDurationMs(ms: number): string {
  if (ms < MINUTE_MS) return `${Math.round(ms / 1000)}s`;
  const hours = Math.floor(ms / HOUR_MS);
  const minutes = Math.round((ms - hours * HOUR_MS) / MINUTE_MS);
  return hours === 0 ? `${minutes}m` : `${hours}h ${minutes}m`;
}

/** Buckets are UTC days, so they are read back in UTC rather than shifted into the reader's zone. */
export function formatUsageDay(day: string): string {
  return new Date(`${day}T00:00:00.000Z`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}
