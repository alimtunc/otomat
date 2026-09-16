import { DaemonRequestError } from "@otomat/client";
import { asRecord, asString } from "@web/lib/coerce";

export function sourceControlMessage(error: unknown): string {
  if (error instanceof DaemonRequestError)
    return (
      asString(asRecord(error.body)?.message) ??
      "Git could not complete this operation. Refresh and try again."
    );
  return "Could not reach the daemon. Check the connection and try again.";
}
