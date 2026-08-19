function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

/** `datetime-local` speaks local wall time with no zone, so the value is built from the local parts rather than sliced off an ISO string. */
export function toDateTimeLocal(instant: Date): string {
  const date = `${instant.getFullYear()}-${pad(instant.getMonth() + 1)}-${pad(instant.getDate())}`;
  return `${date}T${pad(instant.getHours())}:${pad(instant.getMinutes())}`;
}

/** The instant a `datetime-local` value names in this browser's own zone, or null when it names none. */
export function fromDateTimeLocal(value: string): string | null {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
