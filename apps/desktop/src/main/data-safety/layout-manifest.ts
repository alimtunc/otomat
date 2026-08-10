import { randomUUID } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  openSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

import { isUuidV4 } from "@otomat/domain";

import { DataDirectoryError } from "./data-directory-error.js";
import { publishPathDurably } from "./durable-publication.js";
import { combineFailures } from "./failure-composition.js";

const DATA_LAYOUT_VERSION = 1;
export const MANIFEST_FILENAME = "data-layout.json";
const MANIFEST_TEMPORARY_PREFIX = `${MANIFEST_FILENAME}.`;
const MANIFEST_TEMPORARY_SUFFIX = ".partial";

interface DataLayoutManifest {
  version: number;
  created_at: string;
}

export function readManifest(path: string): DataLayoutManifest {
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

export function createManifest(path: string): void {
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

export function cleanupInterruptedManifestCopies(root: string): void {
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
