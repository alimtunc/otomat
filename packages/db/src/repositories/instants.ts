/** SQLite stores `CURRENT_TIMESTAMP` as `YYYY-MM-DD HH:MM:SS` in UTC, while every wire contract carries an ISO instant. */
export function sqliteToIso(timestamp: string): string {
  return timestamp.includes("T") ? timestamp : `${timestamp.replace(" ", "T")}Z`;
}
