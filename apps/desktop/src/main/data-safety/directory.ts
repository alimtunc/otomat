import { lstatSync, mkdirSync, statfsSync, type Stats } from "node:fs";
import { dirname, join } from "node:path";

import { DATABASE_INITIALIZED_MARKER_SUFFIX, MANAGED_BACKUPS_DIRECTORY_NAME } from "@otomat/domain";

import { DataDirectoryError } from "./data-directory-error.js";
import { syncManagedPath } from "./durable-publication.js";
import {
  cleanupInterruptedManifestCopies,
  createManifest,
  MANIFEST_FILENAME,
  readManifest,
} from "./layout-manifest.js";

const MINIMUM_STARTUP_BYTES = 16 * 1024 * 1024;

export interface ManagedDataDirectory {
  root: string;
  dbPath: string;
  backupsDir: string;
  logsDir: string;
  manifestPath: string;
}

function assertExistingPathType(path: string, kind: "directory" | "file"): boolean {
  let stats: Stats | undefined;
  try {
    stats = lstatSync(path, { throwIfNoEntry: false });
  } catch (error) {
    throw new DataDirectoryError(
      "invalid_structure",
      `The managed data path ${path} could not be inspected. No data was changed.`,
      { cause: error },
    );
  }
  if (stats === undefined) return false;
  const valid = kind === "directory" ? stats.isDirectory() : stats.isFile();
  if (valid && !stats.isSymbolicLink()) return true;
  throw new DataDirectoryError(
    "invalid_structure",
    `The managed data path ${path} must be a regular ${kind}. No data was changed.`,
  );
}

function assertStartupCapacity(root: string): void {
  const stats = statfsSync(root);
  const availableBytes = stats.bavail * stats.bsize;
  if (availableBytes >= MINIMUM_STARTUP_BYTES) return;
  throw new DataDirectoryError(
    "low_disk",
    `Otomat needs at least ${MINIMUM_STARTUP_BYTES} free bytes to start safely; ${availableBytes} are available. No data was changed.`,
    { availableBytes, requiredBytes: MINIMUM_STARTUP_BYTES },
  );
}

export function prepareDataDirectory(root: string): ManagedDataDirectory {
  try {
    const rootExists = assertExistingPathType(root, "directory");
    mkdirSync(root, { recursive: true, mode: 0o700 });
    if (!rootExists) syncManagedPath(dirname(root));
    assertStartupCapacity(root);
    const layout: ManagedDataDirectory = {
      root,
      dbPath: join(root, "otomat.db"),
      backupsDir: join(root, MANAGED_BACKUPS_DIRECTORY_NAME),
      logsDir: join(root, "logs"),
      manifestPath: join(root, MANIFEST_FILENAME),
    };
    assertExistingPathType(layout.dbPath, "file");
    const initializedMarkerExists = assertExistingPathType(
      `${layout.dbPath}${DATABASE_INITIALIZED_MARKER_SUFFIX}`,
      "file",
    );
    for (const directory of [
      layout.backupsDir,
      layout.logsDir,
      join(root, "runs"),
      join(root, "worktrees"),
    ]) {
      assertExistingPathType(directory, "directory");
    }
    const manifestExists = assertExistingPathType(layout.manifestPath, "file");
    if (manifestExists) {
      readManifest(layout.manifestPath);
    } else {
      if (initializedMarkerExists) {
        throw new DataDirectoryError(
          "unsupported_layout",
          "The initialized data directory is missing its layout manifest. No data was changed.",
        );
      }
      cleanupInterruptedManifestCopies(root);
      createManifest(layout.manifestPath);
    }
    mkdirSync(layout.backupsDir, { recursive: true, mode: 0o700 });
    mkdirSync(layout.logsDir, { recursive: true, mode: 0o700 });
    syncManagedPath(root);
    return layout;
  } catch (error) {
    if (error instanceof DataDirectoryError) throw error;
    throw new DataDirectoryError(
      "invalid_structure",
      "The managed data directory could not be prepared durably.",
      { cause: error },
    );
  }
}

export { DataDirectoryError };
