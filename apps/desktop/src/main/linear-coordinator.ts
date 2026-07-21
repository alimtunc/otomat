import type { LinearVaultOperationResult } from "@otomat/domain";

import { clearLinearKey, LinearHandoffError, pushLinearKey } from "#shared/linear-handoff";
import type { LinearVault } from "#shared/linear-vault";

function describeFailure(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export class LinearCoordinator {
  private tail: Promise<void> = Promise.resolve();

  constructor(
    private readonly vault: LinearVault,
    private readonly daemonUrl: () => string,
  ) {}

  save(apiKey: unknown): Promise<LinearVaultOperationResult> {
    return this.enqueue(() => this.saveNow(apiKey));
  }

  forget(): Promise<LinearVaultOperationResult> {
    return this.enqueue(() => this.forgetNow());
  }

  restore(): Promise<void> {
    return this.enqueue(async () => {
      try {
        const apiKey = this.vault.load();
        if (apiKey !== null) await pushLinearKey({ daemonUrl: this.daemonUrl(), apiKey });
      } catch (error) {
        console.error("[otomat-desktop] restoring the Linear connection failed", error);
      }
    });
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.tail.then(operation);
    this.tail = next.then(
      () => undefined,
      (error) => console.error("[otomat-desktop] queued Linear operation failed", error),
    );
    return next;
  }

  private async forgetNow(): Promise<LinearVaultOperationResult> {
    try {
      this.vault.clear();
    } catch (error) {
      return {
        ok: false,
        message: describeFailure(error, "Forgetting the Linear key failed."),
        error_code: null,
      };
    }
    try {
      await clearLinearKey(this.daemonUrl());
      return { ok: true, message: null };
    } catch (error) {
      return {
        ok: false,
        message: describeFailure(error, "Disconnecting Linear failed."),
        error_code: null,
      };
    }
  }

  private async saveNow(apiKey: unknown): Promise<LinearVaultOperationResult> {
    if (typeof apiKey !== "string" || apiKey.trim() === "") {
      return { ok: false, message: "Provide a Linear Personal API key.", error_code: null };
    }
    const normalizedKey = apiKey.trim();
    try {
      await pushLinearKey({ daemonUrl: this.daemonUrl(), apiKey: normalizedKey });
    } catch (error) {
      return {
        ok: false,
        message: describeFailure(error, "Connecting Linear failed."),
        error_code: error instanceof LinearHandoffError ? error.code : null,
      };
    }
    try {
      this.vault.save(normalizedKey);
      return { ok: true, message: null };
    } catch (error) {
      try {
        await clearLinearKey(this.daemonUrl());
      } catch (rollbackError) {
        console.error("[otomat-desktop] rolling back the Linear connection failed", rollbackError);
        return {
          ok: false,
          message: `${describeFailure(error, "Saving the Linear key failed.")} The daemon connection could not be rolled back.`,
          error_code: null,
        };
      }
      return {
        ok: false,
        message: describeFailure(error, "Saving the Linear key failed."),
        error_code: null,
      };
    }
  }
}
