import type {
  LinearDeliverySnapshot,
  LinearVaultOperationResult,
  PreviewSandboxResetResult,
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
    exportSupportBundle: () => context.support.exportBundle(),
    showDataPolicy: () => context.support.showDataPolicy(),
    resetSandbox: async (): Promise<PreviewSandboxResetResult> => {
      const reset = context.runtime()?.sandbox.reset();
      const result = await (reset ?? Promise.resolve(SANDBOX_NOT_READY));
      // Reload only after success: a failure must leave the page alive to show the message.
      if (result.ok) context.reloadCockpit();
      return result;
    },
    executionHost: buildExecutionHostActions(
      () => context.runtime()?.hosts ?? null,
      () => context.runtime()?.instances ?? null,
    ),
  };
}
