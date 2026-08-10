import {
  isRecoverableDataSafetyErrorCode,
  type DataSafetyErrorCode,
  type PlainDataSafetyErrorCode,
  type RecoverableDataSafetyErrorCode,
} from "@otomat/domain";

export type { DataSafetyErrorCode } from "@otomat/domain";

export interface RecoverableDataSafetyErrorOptions extends ErrorOptions {
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
