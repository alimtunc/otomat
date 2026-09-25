import { DaemonRequestError, DaemonTransportError } from "@otomat/client";
import { daemonErrorMessage } from "@web/lib/daemon-error";

const UNREACHABLE =
  "The terminal is unavailable. Reconnect to the host or use an external terminal.";

export function terminalError(error: unknown): string {
  if (error instanceof DaemonRequestError || error instanceof DaemonTransportError)
    return daemonErrorMessage(error, UNREACHABLE);
  return error instanceof Error ? error.message : UNREACHABLE;
}
