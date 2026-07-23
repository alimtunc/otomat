import { randomUUID } from "node:crypto";
import { basename, dirname, join } from "node:path";

import { isUuidV4ArtifactName } from "./artifact-names.js";

export const RESTORE_TEMPORARY_SUFFIX = ".partial";

export function restoreTemporaryPrefix(dbPath: string): string {
  return `${basename(dbPath)}.restore-`;
}

export function createRestoreTemporaryPath(dbPath: string): string {
  return join(
    dirname(dbPath),
    `${restoreTemporaryPrefix(dbPath)}${randomUUID()}${RESTORE_TEMPORARY_SUFFIX}`,
  );
}

export function isRestoreTemporaryName(dbPath: string, filename: string): boolean {
  return isUuidV4ArtifactName(filename, restoreTemporaryPrefix(dbPath), RESTORE_TEMPORARY_SUFFIX);
}
