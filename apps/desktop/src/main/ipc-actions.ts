import {
  errorDiagnosticSchema,
  problemReportDraftSchema,
  type LinearDeliverySnapshot,
  type LinearVaultOperationResult,
  type PreviewSandboxResetResult,
  type SupportBundleExportResult,
} from "@otomat/domain";

import type { IpcActions } from "./ipc.js";
import { SANDBOX_NOT_READY } from "./preview/sandbox.js";
import { buildExecutionHostActions } from "./remote/ipc-actions.js";
import type { DesktopRuntime } from "./runtime.js";
import type { DesktopSupport } from "./support.js";

const NO_DELIVERY: LinearDeliverySnapshot = { stored: false, hosts: [] };

const NOT_READY: LinearVaultOperationResult = {
  ok: false,
  message: "The desktop runtime is not ready yet.",
  error_code: null,
};

const REJECTED_DIAGNOSTIC: SupportBundleExportResult = {
  status: "failed",
  message: "The diagnostic could not be read, so nothing was written.",
};

export interface IpcActionContext {
  runtime(): DesktopRuntime | null;
  support: DesktopSupport;
  restoreBackup(): Promise<void>;
  /** Reloads the cockpit against the daemon a reset left behind. */
  reloadCockpit(): void;
}

/** Every renderer-facing action, bound to the runtime and degrading honestly before it exists. */
export function buildIpcActions(context: IpcActionContext): IpcActions {
  return {
    saveLinearKey: (apiKey) => context.runtime()?.linear.save(apiKey) ?? Promise.resolve(NOT_READY),
    forgetLinearKey: () => context.runtime()?.linear.forget() ?? Promise.resolve(NOT_READY),
    linearDelivery: () => context.runtime()?.linear.snapshot() ?? NO_DELIVERY,
    restoreBackup: () => context.restoreBackup(),
    exportSupportBundle: () => context.support.exportBundleWithFeedback(),
    exportSupportBundleFor: async (diagnostic: unknown): Promise<SupportBundleExportResult> => {
      const parsed = errorDiagnosticSchema.safeParse(diagnostic);
      if (!parsed.success) return REJECTED_DIAGNOSTIC;
      return context.support.exportBundle(parsed.data);
    },
    openReportDraft: async (draft: unknown): Promise<void> => {
      await context.support.openReportDraft(problemReportDraftSchema.parse(draft));
    },
    showDataPolicy: () => context.support.showDataPolicy(),
    resetSandbox: async (): Promise<PreviewSandboxResetResult> => {
      const runtime = context.runtime();
      // In remote mode the renderer shows remote data; wiping the off-screen local
      // sandbox would report a success the user cannot see anywhere.
      if (runtime?.hosts.activeHostId === "remote") {
        return {
          ok: false,
          message: "Reset test data only resets the local sandbox. Switch to the Local host first.",
        };
      }
      const reset = runtime?.sandbox.reset();
      const result = await (reset ?? Promise.resolve(SANDBOX_NOT_READY));
      if (result.ok) context.reloadCockpit();
      return result;
    },
    executionHost: buildExecutionHostActions(
      () => context.runtime()?.hosts ?? null,
      () => context.runtime()?.instances ?? null,
      () => context.runtime()?.capacity ?? null,
    ),
  };
}
