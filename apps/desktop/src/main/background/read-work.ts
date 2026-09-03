import { createDaemonClient, DaemonTransportError } from "@otomat/client";

import { summarizeLocalWork, type LocalWorkSummary } from "./work-summary.js";

export type LocalWorkReading =
  | { ok: true; summary: LocalWorkSummary }
  | { ok: false; message: string };

const NOT_STARTED: LocalWorkSummary = { active: 0, waiting: 0, failed: 0 };

/** A wedged daemon would otherwise hold the window's close, and with it every quit, indefinitely. */
const READ_TIMEOUT_MS = 2_000;

const boundedFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, signal: AbortSignal.timeout(READ_TIMEOUT_MS) });

/** An unreadable daemon is reported, never counted as an idle one: quitting would still cut its runs. */
export async function readLocalWork(
  daemonUrl: string,
  fetchImpl: typeof fetch = boundedFetch,
): Promise<LocalWorkReading> {
  if (daemonUrl === "") return { ok: true, summary: NOT_STARTED };
  const client = createDaemonClient({ baseUrl: daemonUrl, fetch: fetchImpl });
  try {
    return { ok: true, summary: summarizeLocalWork((await client.listActivity()).activities) };
  } catch (error) {
    const reason = error instanceof DaemonTransportError ? error.cause : error;
    return { ok: false, message: `Could not read the local daemon's activity: ${String(reason)}` };
  }
}
