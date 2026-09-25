import { createDaemonClient, DaemonTransportError, type DaemonEndpoint } from "@otomat/client";

import { localWorkItems, type LocalWorkItem } from "./work-items.js";

export type LocalWorkReading =
  | { ok: true; items: LocalWorkItem[] }
  | { ok: false; message: string };

/** A wedged daemon would otherwise hold the window's close, and with it every quit, indefinitely. */
const READ_TIMEOUT_MS = 2_000;

const boundedFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, signal: AbortSignal.timeout(READ_TIMEOUT_MS) });

/** An unreadable daemon is reported, never counted as an idle one: quitting would still cut its runs. */
export async function readLocalWork(
  daemon: DaemonEndpoint | null,
  fetchImpl: typeof fetch = boundedFetch,
): Promise<LocalWorkReading> {
  if (daemon === null) return { ok: true, items: [] };
  const client = createDaemonClient({ ...daemon, fetch: fetchImpl });
  try {
    const [activity, terminals] = await Promise.all([
      client.listActivity(),
      client.listTerminals(),
    ]);
    return { ok: true, items: localWorkItems(activity.activities, terminals.sessions) };
  } catch (error) {
    const reason = error instanceof DaemonTransportError ? error.cause : error;
    return { ok: false, message: `Could not read the local daemon's activity: ${String(reason)}` };
  }
}
