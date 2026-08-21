import type { RuntimeUnavailableReason } from "@otomat/domain";

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class RuntimeUnavailableError extends Error {
  constructor(
    readonly runtime: string,
    readonly reason: RuntimeUnavailableReason,
    message = `runtime "${runtime}" is unavailable (${reason})`,
  ) {
    super(message);
    this.name = "RuntimeUnavailableError";
  }
}
