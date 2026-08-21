/** SQLite stores `CURRENT_TIMESTAMP` as `YYYY-MM-DD HH:MM:SS` in UTC, while every wire contract carries an ISO instant. */
export function sqliteToIso(timestamp: string): string {
  return timestamp.includes("T") ? timestamp : `${timestamp.replace(" ", "T")}Z`;
}

/** The inverse, so an ISO bound compares against stored timestamps as text rather than sorting after all of them. */
export function isoToSqlite(iso: string): string {
  return new Date(iso).toISOString().slice(0, 19).replace("T", " ");
}
