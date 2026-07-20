import type { LinearErrorCode } from "@otomat/domain";

/**
 * Every Linear refusal the daemon raises. Messages are fixed strings written
 * here, never provider output, so a request that carried the API key can never
 * be echoed into a log, a response, or the database.
 */
export class LinearError extends Error {
  constructor(
    readonly code: LinearErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "LinearError";
  }
}

export const LINEAR_ERROR_MESSAGES: Record<LinearErrorCode, string> = {
  linear_not_connected: "Connect a Linear workspace first.",
  linear_unauthorized: "Linear rejected the API key. Create a new key and connect again.",
  linear_rate_limited: "Linear is rate limiting this workspace. Try again later.",
  linear_unavailable: "Linear is unreachable. Check your connection and try again.",
  linear_request_failed: "Linear returned an unexpected response.",
  linear_source_not_found: "That Linear source is not mapped.",
  linear_source_already_mapped: "That Linear team or project is already mapped.",
  linear_project_not_found: "That local project does not exist.",
};

export function linearError(code: LinearErrorCode): LinearError {
  return new LinearError(code, LINEAR_ERROR_MESSAGES[code]);
}

/** Collapses anything unknown into a safe fixed pair before it is persisted or serialized. */
export function safeLinearFailure(error: unknown): { code: LinearErrorCode; message: string } {
  if (error instanceof LinearError) return { code: error.code, message: error.message };
  return {
    code: "linear_request_failed",
    message: LINEAR_ERROR_MESSAGES.linear_request_failed,
  };
}
