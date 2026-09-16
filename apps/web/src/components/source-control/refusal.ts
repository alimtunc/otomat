import { daemonErrorMessage } from "@web/lib/daemon-error";

export function sourceControlMessage(error: unknown): string {
  return daemonErrorMessage(
    error,
    "Git could not complete this operation. Refresh and try again.",
    "Could not reach the daemon. Check the connection and try again.",
  );
}
