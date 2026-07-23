import {
  isRecoverableDataSafetyErrorCode,
  type DesktopStartupDiagnostic,
  type RecoverableDataSafetyErrorCode,
} from "@otomat/domain";

import { DaemonStartupError } from "./daemon.js";
import { DataDirectoryError } from "./data-safety/index.js";

export function isRecoverableStartupDiagnostic(
  diagnostic: DesktopStartupDiagnostic,
): diagnostic is Extract<DesktopStartupDiagnostic, { code: RecoverableDataSafetyErrorCode }> {
  return (
    diagnostic.code !== "data_directory_invalid" &&
    diagnostic.code !== "startup_failed" &&
    isRecoverableDataSafetyErrorCode(diagnostic.code)
  );
}

export function describeStartupFailure(error: unknown): DesktopStartupDiagnostic {
  if (error instanceof DaemonStartupError) {
    return error.diagnostic;
  }
  if (error instanceof DataDirectoryError) {
    if (error.details.code === "low_disk") {
      return {
        code: "low_disk",
        message: "There is not enough free disk space to start Otomat safely.",
        backup_path: null,
        available_bytes: error.details.availableBytes,
        required_bytes: error.details.requiredBytes,
      };
    }
    return {
      code: "data_directory_invalid",
      message:
        error.details.code === "unsupported_layout"
          ? "This data directory was created by an incompatible Otomat version."
          : "The Otomat data directory has an invalid structure.",
      backup_path: null,
      available_bytes: null,
      required_bytes: null,
    };
  }
  return {
    code: "startup_failed",
    message: "The local daemon could not be started.",
    backup_path: null,
    available_bytes: null,
    required_bytes: null,
  };
}
