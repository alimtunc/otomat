import { restoreDatabaseBackup } from "@otomat/db";

export async function runRestoreMaintenance(dbPath: string, backupPath: string): Promise<string> {
  const restored = await restoreDatabaseBackup(dbPath, backupPath);
  return `[otomat-maintenance] ${JSON.stringify({
    action: "restore",
    ...(restored.preservedPath === null ? {} : { preserved_path: restored.preservedPath }),
  })}`;
}
