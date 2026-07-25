import { z } from "zod";

import {
  PLAIN_DATA_SAFETY_ERROR_CODES,
  RECOVERABLE_DATA_SAFETY_ERROR_CODES,
} from "./data-safety.js";
import type { LinearErrorCode } from "./linear.js";

const startupDiagnosticBase = z.object({
  message: z.string().min(1),
});

const plainStartupDiagnosticSchema = startupDiagnosticBase.extend({
  code: z.enum([...PLAIN_DATA_SAFETY_ERROR_CODES, "data_directory_invalid", "startup_failed"]),
  backup_path: z.null(),
  available_bytes: z.null(),
  required_bytes: z.null(),
});

const recoverableStartupDiagnosticSchema = startupDiagnosticBase.extend({
  code: z.enum(RECOVERABLE_DATA_SAFETY_ERROR_CODES),
  backup_path: z.string().nullable(),
  available_bytes: z.null(),
  required_bytes: z.null(),
});

const lowDiskStartupDiagnosticSchema = startupDiagnosticBase.extend({
  code: z.literal("low_disk"),
  backup_path: z.null(),
  available_bytes: z.number().int().nonnegative(),
  required_bytes: z.number().int().nonnegative(),
});

export const desktopStartupDiagnosticSchema = z.discriminatedUnion("code", [
  plainStartupDiagnosticSchema,
  recoverableStartupDiagnosticSchema,
  lowDiskStartupDiagnosticSchema,
]);
export type DesktopStartupDiagnostic = z.infer<typeof desktopStartupDiagnosticSchema>;

export type LinearVaultOperationResult =
  | { ok: true; message: null }
  | { ok: false; message: string; error_code: LinearErrorCode | null };

/**
 * The narrow surface the Electron desktop shell exposes to the renderer through
 * `contextBridge` as `window.otomat`. Absent in the browser (dev/web), where the
 * daemon URL comes from the build-time env and there is no native folder picker.
 */
export interface OtomatDesktopBridge {
  /** Origin of the daemon the desktop shell launched (dynamic loopback port). */
  readonly daemonUrl: string;
  /** Opens the native directory chooser; resolves to the absolute path, or null when canceled. */
  pickDirectory(): Promise<string | null>;
  linear: {
    saveKey(apiKey: string): Promise<LinearVaultOperationResult>;
    forgetKey(): Promise<LinearVaultOperationResult>;
  };
}
