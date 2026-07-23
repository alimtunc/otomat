import { randomUUID } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  rmSync,
  statfsSync,
  type Stats,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

import {
  DATABASE_INITIALIZED_MARKER_SUFFIX,
  isUuidV4,
  MANAGED_BACKUPS_DIRECTORY_NAME,
} from "@otomat/domain";

import { DataDirectoryError } from "./data-directory-error.js";
import { publishPathDurably, syncManagedPath } from "./durable-publication.js";
import { combineFailures } from "./failure-composition.js";

const DATA_LAYOUT_VERSION = 1;
const MANIFEST_FILENAME = "data-layout.json";
const MANIFEST_TEMPORARY_PREFIX = `${MANIFEST_FILENAME}.`;
const MANIFEST_TEMPORARY_SUFFIX = ".partial";
const MINIMUM_STARTUP_BYTES = 16 * 1024 * 1024;

export interface ManagedDataDirectory {
  root: string;
  dbPath: string;
  backupsDir: string;
  logsDir: string;
  manifestPath: string;
}

interface DataLayoutManifest {
  version: number;
  created_at: string;
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

function readManifest(path: string): DataLayoutManifest {
  let parsed: unknown;
  let descriptor: number | null = null;
  const failures: unknown[] = [];
  try {
    descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    if (!fstatSync(descriptor).isFile()) throw new Error("Manifest is not a regular file.");
    parsed = JSON.parse(readFileSync(descriptor, "utf8"));
  } catch (error) {
    failures.push(error);
  }
  if (descriptor !== null) {
    try {
      closeSync(descriptor);
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length > 0) {
    throw new DataDirectoryError(
      "invalid_structure",
      `The data layout manifest at ${path} could not be read safely. No data was changed.`,
      {
        cause: combineFailures(failures, "Manifest read and handle cleanup both failed."),
      },
    );
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("version" in parsed) ||
    typeof parsed.version !== "number" ||
    !("created_at" in parsed) ||
    typeof parsed.created_at !== "string" ||
    Number.isNaN(Date.parse(parsed.created_at))
  ) {
    throw new DataDirectoryError(
      "invalid_structure",
      `The data layout manifest at ${path} has an invalid structure. No data was changed.`,
    );
  }
  if (parsed.version !== DATA_LAYOUT_VERSION) {
    throw new DataDirectoryError(
      "unsupported_layout",
      `Data layout version ${parsed.version} is not supported by this Otomat build. No data was changed.`,
    );
  }
  return { version: parsed.version, created_at: parsed.created_at };
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

function createManifest(path: string): void {
  const temporaryPath = `${path}.${randomUUID()}.partial`;
  try {
    writeFileSync(
      temporaryPath,
      `${JSON.stringify({
        version: DATA_LAYOUT_VERSION,
        created_at: new Date().toISOString(),
      })}\n`,
      { flag: "wx", mode: 0o600 },
    );
    publishPathDurably(temporaryPath, path);
  } catch (error) {
    try {
      rmSync(temporaryPath, { force: true });
    } catch (cleanupError) {
      const failure = new Error("The data layout manifest and its temporary file both failed.", {
        cause: error,
      });
      Object.defineProperty(failure, "cleanupFailures", { value: [cleanupError] });
      throw failure;
    }
    throw error;
  }
}

function cleanupInterruptedManifestCopies(root: string): void {
  try {
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (
        !entry.name.startsWith(MANIFEST_TEMPORARY_PREFIX) ||
        !entry.name.endsWith(MANIFEST_TEMPORARY_SUFFIX) ||
        !isUuidV4(
          entry.name.slice(MANIFEST_TEMPORARY_PREFIX.length, -MANIFEST_TEMPORARY_SUFFIX.length),
        )
      ) {
        continue;
      }
      if (!entry.isFile() && !entry.isSymbolicLink()) {
        throw new Error(`Managed manifest temporary path ${entry.name} is not a regular file.`);
      }
      rmSync(join(root, entry.name), { force: true });
    }
  } catch (error) {
    throw new DataDirectoryError(
      "invalid_structure",
      "Interrupted data layout manifest copies could not be cleaned safely.",
      { cause: error },
    );
  }
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
