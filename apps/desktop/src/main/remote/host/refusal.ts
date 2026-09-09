import { DaemonRequestError, DaemonTransportError } from "@otomat/client";
import type { ExecutionHostId } from "@otomat/domain";

/** Null when the error is neither a refusal nor a transport failure: the caller owns what an unrecognised answer means. */
export function hostCommandRefusal(
  error: unknown,
  hostId: ExecutionHostId,
  operation: string,
  log: (message: string) => void,
  refused: (status: number, body: unknown) => string,
): { message: string } | null {
  if (error instanceof DaemonRequestError) {
    return { message: refused(error.status, error.body) };
  }
  if (error instanceof DaemonTransportError) {
    log(`${operation} on ${hostId} failed: ${String(error.cause)}`);
    return { message: `Could not reach the ${hostId} daemon: ${String(error.cause)}` };
  }
  return null;
}
