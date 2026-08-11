import { emitLedgerEvent } from "#events";
import { buildRuntimeEvent } from "#runtime";

import type { SupervisorState } from "./state.js";
import { SUPERVISOR_ADAPTER } from "./types.js";

/** A log line the supervisor itself wrote — init output, or why it could not start the work. */
export function emitSupervisorLog(
  state: SupervisorState,
  runId: string,
  stream: "stdout" | "stderr",
  text: string,
): void {
  emitLedgerEvent(
    state.db,
    state.dataDir,
    runId,
    buildRuntimeEvent({
      runId,
      kind: "runtime.log",
      type: "runtime.log",
      source: "otomat",
      adapter: SUPERVISOR_ADAPTER,
      fidelity: "raw_log",
      occurredAt: new Date().toISOString(),
      payload: { stream, text },
    }),
  );
}
