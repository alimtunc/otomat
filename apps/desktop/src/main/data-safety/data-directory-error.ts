export type DataDirectoryErrorCode = "invalid_structure" | "low_disk" | "unsupported_layout";

interface LowDiskDetails extends ErrorOptions {
  availableBytes: number;
  requiredBytes: number;
}

export class DataDirectoryError extends Error {
  readonly details:
    | {
        code: Exclude<DataDirectoryErrorCode, "low_disk">;
        availableBytes: null;
        requiredBytes: null;
      }
    | {
        code: "low_disk";
        availableBytes: number;
        requiredBytes: number;
      };

  constructor(
    code: Exclude<DataDirectoryErrorCode, "low_disk">,
    message: string,
    options?: ErrorOptions,
  );
  constructor(code: "low_disk", message: string, options: LowDiskDetails);
  constructor(
    code: DataDirectoryErrorCode,
    message: string,
    options: ErrorOptions & Partial<LowDiskDetails> = {},
  ) {
    super(message, options);
    this.name = "DataDirectoryError";
    if (code === "low_disk") {
      if (typeof options.availableBytes !== "number" || typeof options.requiredBytes !== "number") {
        throw new TypeError("A low-disk failure requires available and required byte counts.");
      }
      this.details = {
        code,
        availableBytes: options.availableBytes,
        requiredBytes: options.requiredBytes,
      };
    } else {
      this.details = { code, availableBytes: null, requiredBytes: null };
    }
  }

  get code(): DataDirectoryErrorCode {
    return this.details.code;
  }

  get availableBytes(): number | null {
    return this.details.availableBytes;
  }

  get requiredBytes(): number | null {
    return this.details.requiredBytes;
  }
}
