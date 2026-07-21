import type { LinearErrorCode } from "@otomat/domain";

export class LinearError extends Error {
  constructor(
    readonly code: LinearErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "LinearError";
  }
}

const LINEAR_ERROR_MESSAGES: Record<LinearErrorCode, string> = {
  linear_not_connected: "Connect a Linear workspace first.",
  linear_unauthorized: "Linear rejected the API key. Create a new key and connect again.",
  linear_rate_limited: "Linear is rate limiting this workspace. Try again later.",
  linear_unavailable: "Linear is unreachable. Check your connection and try again.",
  linear_request_failed: "Linear returned an unexpected response.",
  linear_request_superseded: "A newer Linear connection state replaced this request.",
  linear_source_not_found: "That Linear source is not mapped.",
  linear_source_already_mapped: "That Linear team or project is already mapped.",
  linear_source_invalid_selection: "That team or project is not available in this workspace.",
  linear_project_not_found: "That local project does not exist.",
};

export function linearError(code: LinearErrorCode, cause?: unknown): LinearError {
  return new LinearError(
    code,
    LINEAR_ERROR_MESSAGES[code],
    cause === undefined ? undefined : { cause },
  );
}
