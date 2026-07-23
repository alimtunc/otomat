import { lstatSync } from "node:fs";

import {
  isPlainDataSafetyErrorCode,
  isRecoverableDataSafetyErrorCode,
  type DataSafetyErrorCode,
  type PlainDataSafetyErrorCode,
  type RecoverableDataSafetyErrorCode,
} from "@otomat/domain";

export type { DataSafetyErrorCode } from "@otomat/domain";

interface RecoverableDataSafetyErrorOptions extends ErrorOptions {
  backupPath?: string | null;
}

interface LowDiskDataSafetyErrorOptions extends ErrorOptions {
  availableBytes: number;
  requiredBytes: number;
}

type DataSafetyErrorDetails =
  | {
      code: PlainDataSafetyErrorCode;
      backupPath: null;
      availableBytes: null;
      requiredBytes: null;
    }
  | {
      code: RecoverableDataSafetyErrorCode;
      backupPath: string | null;
      availableBytes: null;
      requiredBytes: null;
    }
  | {
      code: "low_disk";
      backupPath: null;
      availableBytes: number;
      requiredBytes: number;
    };

export class DataSafetyError extends Error {
  readonly details: DataSafetyErrorDetails;

  constructor(code: PlainDataSafetyErrorCode, message: string, options?: ErrorOptions);
  constructor(
    code: RecoverableDataSafetyErrorCode,
    message: string,
    options?: RecoverableDataSafetyErrorOptions,
  );
  constructor(code: "low_disk", message: string, options: LowDiskDataSafetyErrorOptions);
  constructor(
    code: DataSafetyErrorCode,
    message: string,
    options: ErrorOptions &
      Partial<RecoverableDataSafetyErrorOptions & LowDiskDataSafetyErrorOptions> = {},
  ) {
    super(message, options);
    this.name = "DataSafetyError";
    if (code === "low_disk") {
      if (typeof options.availableBytes !== "number" || typeof options.requiredBytes !== "number") {
        throw new TypeError("A low-disk failure requires available and required byte counts.");
      }
      this.details = {
        code,
        backupPath: null,
        availableBytes: options.availableBytes,
        requiredBytes: options.requiredBytes,
      };
    } else if (isRecoverableDataSafetyErrorCode(code)) {
      this.details = {
        code,
        backupPath: options.backupPath ?? null,
        availableBytes: null,
        requiredBytes: null,
      };
    } else {
      this.details = {
        code,
        backupPath: null,
        availableBytes: null,
        requiredBytes: null,
      };
    }
  }

  get code(): DataSafetyErrorCode {
    return this.details.code;
  }

  get backupPath(): string | null {
    return this.details.backupPath;
  }

  get availableBytes(): number | null {
    return this.details.availableBytes;
  }

  get requiredBytes(): number | null {
    return this.details.requiredBytes;
  }
}

function aggregateCause(failures: unknown[]): unknown {
  return failures.length === 1
    ? failures[0]
    : new AggregateError(failures, "The data-safety operation and its cleanup both failed.");
}

/** Settles a failure already classified as a `DataSafetyError`, keeping its code and message. */
export function preserveClassifiedFailure(
  source: DataSafetyError,
  secondaryFailures: unknown[],
  options: RecoverableDataSafetyErrorOptions = {},
): DataSafetyError {
  const needsKnownBackupPath =
    isRecoverableDataSafetyErrorCode(source.code) &&
    source.backupPath === null &&
    options.backupPath != null;
  if (secondaryFailures.length === 0 && !needsKnownBackupPath) return source;
  const cause = aggregateCause([source, ...secondaryFailures]);
  const details = source.details;
  if (details.code === "low_disk") {
    return new DataSafetyError("low_disk", source.message, {
      availableBytes: details.availableBytes,
      requiredBytes: details.requiredBytes,
      cause,
    });
  }
  if (isRecoverableDataSafetyErrorCode(details.code)) {
    return new DataSafetyError(details.code, source.message, {
      backupPath: details.backupPath ?? options.backupPath,
      cause,
    });
  }
  return new DataSafetyError(details.code, source.message, { cause });
}

export function preserveDataSafetyFailure(
  primary: unknown,
  secondaryFailures: unknown[],
  fallbackCode: Exclude<DataSafetyErrorCode, "low_disk">,
  fallbackMessage: string,
  options: RecoverableDataSafetyErrorOptions = {},
): DataSafetyError {
  if (primary instanceof DataSafetyError) {
    return preserveClassifiedFailure(primary, secondaryFailures, options);
  }
  const cause = aggregateCause([primary, ...secondaryFailures]);
  if (isRecoverableDataSafetyErrorCode(fallbackCode)) {
    return new DataSafetyError(fallbackCode, fallbackMessage, {
      backupPath: options.backupPath,
      cause,
    });
  }
  if (isPlainDataSafetyErrorCode(fallbackCode)) {
    return new DataSafetyError(fallbackCode, fallbackMessage, { cause });
  }
  throw new Error("An unknown data-safety error reached recovery.", { cause });
}

/** Rethrows a lone failure by identity so its classification survives; aggregates several. */
export function throwCollectedFailures(failures: unknown[], message: string): void {
  if (failures.length === 0) return;
  if (failures.length === 1) throw failures[0];
  throw new AggregateError(failures, message);
}

export function collectCleanupFailure(failures: unknown[], cleanup: () => void): void {
  try {
    cleanup();
  } catch (error) {
    failures.push(error);
  }
}

export function throwIfUnclassifiedFailure(
  primary: unknown,
  secondaryFailures: unknown[],
  message: string,
): asserts primary is DataSafetyError {
  if (primary instanceof DataSafetyError) return;
  if (secondaryFailures.length === 0) throw primary;
  throw new AggregateError([primary, ...secondaryFailures], message, { cause: primary });
}

export function isSqliteContentError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) return false;
  return error.code === "SQLITE_CORRUPT" || error.code === "SQLITE_NOTADB";
}

export function inspectPathAfterFailure(
  path: string,
  operationFailure: unknown,
): { cause: unknown; missing: boolean } {
  try {
    return {
      cause: operationFailure,
      missing: lstatSync(path, { throwIfNoEntry: false }) === undefined,
    };
  } catch (inspectionFailure) {
    return {
      cause: new AggregateError(
        [operationFailure, inspectionFailure],
        "The operation failed and the database path could not be inspected.",
      ),
      missing: false,
    };
  }
}
