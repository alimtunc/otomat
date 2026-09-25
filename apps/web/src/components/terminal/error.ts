import { DaemonRequestError } from "@otomat/client";

export function terminalError(error: unknown): string {
  if (
    error instanceof DaemonRequestError &&
    typeof error.body === "object" &&
    error.body !== null &&
    "message" in error.body &&
    typeof error.body.message === "string"
  )
    return error.body.message;
  return error instanceof Error
    ? error.message
    : "The terminal is unavailable. Reconnect to the host or use an external terminal.";
}
