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

export type DataSafetyErrorDetails =
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

export function preserveDataSafetyFailure(
  primary: unknown,
  secondaryFailures: unknown[],
  fallbackCode: Exclude<DataSafetyErrorCode, "low_disk">,
  fallbackMessage: string,
  options: RecoverableDataSafetyErrorOptions = {},
): DataSafetyError {
  const source = primary instanceof DataSafetyError ? primary : null;
  const needsKnownBackupPath =
    source !== null &&
    isRecoverableDataSafetyErrorCode(source.code) &&
    source.backupPath === null &&
    options.backupPath != null;
  if (secondaryFailures.length === 0 && source !== null && !needsKnownBackupPath) return source;
  const failures = [primary, ...secondaryFailures];
  const cause =
    failures.length === 1
      ? failures[0]
      : new AggregateError(failures, "The data-safety operation and its cleanup both failed.");
  if (source?.details.code === "low_disk") {
    return new DataSafetyError("low_disk", source.message, {
      availableBytes: source.details.availableBytes,
      requiredBytes: source.details.requiredBytes,
      cause,
    });
  }
  const code = source?.code ?? fallbackCode;
  const message = source?.message ?? fallbackMessage;
  if (code === "low_disk") {
    throw new Error("A low-disk failure reached non-capacity recovery.", { cause });
  }
  if (isRecoverableDataSafetyErrorCode(code)) {
    return new DataSafetyError(code, message, {
      backupPath: source?.backupPath ?? options.backupPath,
      cause,
    });
  }
  if (isPlainDataSafetyErrorCode(code)) {
    return new DataSafetyError(code, message, { cause });
  }
  throw new Error("An unknown data-safety error reached recovery.", { cause });
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
): void {
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
