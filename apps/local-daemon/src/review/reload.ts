/** Re-read a row we just wrote; a null means it vanished under us — a real fault, not a not-found. */
export function reloadOrThrow<T>(read: () => T | null | undefined, describe: string): T {
  const row = read();
  if (row === null || row === undefined) throw new Error(describe);
  return row;
}
