import { restoreDatabaseBackup } from "@otomat/db";

/** Returns the directory holding the replaced database, or null when there was none. */
export async function runRestoreMaintenance(
  dbPath: string,
  backupPath: string,
): Promise<string | null> {
  const restored = await restoreDatabaseBackup(dbPath, backupPath);
  return restored.preservedPath;
}
