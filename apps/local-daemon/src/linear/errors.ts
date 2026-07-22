import type { LinearErrorCode, LinearIssueSnapshot } from "@otomat/domain";

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

/** A blocked fields publish, carrying the current remote values for explicit resolution. */
export class LinearWriteConflictError extends LinearError {
  constructor(readonly remote: LinearIssueSnapshot) {
    super("linear_write_conflict", LINEAR_ERROR_MESSAGES.linear_write_conflict);
    this.name = "LinearWriteConflictError";
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
  linear_issue_not_found: "That Linear issue is not mirrored locally.",
  linear_remote_issue_not_found: "That issue no longer exists on Linear.",
  linear_issue_not_writable: "Only a Linear-sourced issue can be edited or published.",
  linear_write_conflict: "The Linear issue changed since you started editing.",
  linear_write_not_found: "That Linear write attempt no longer exists.",
};

export function linearError(code: LinearErrorCode, cause?: unknown): LinearError {
  return new LinearError(
    code,
    LINEAR_ERROR_MESSAGES[code],
    cause === undefined ? undefined : { cause },
  );
}
