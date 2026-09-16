import { DaemonRequestError } from "@otomat/client";
import { asRecord, asString } from "@web/lib/coerce";

/** A refusal carries the daemon's own sentence; the transport has none, so its fallback may differ. */
export function daemonErrorMessage(
  error: unknown,
  fallback: string,
  unreachable: string = fallback,
): string {
  if (!(error instanceof DaemonRequestError)) return unreachable;
  return asString(asRecord(error.body)?.message) || fallback;
}
