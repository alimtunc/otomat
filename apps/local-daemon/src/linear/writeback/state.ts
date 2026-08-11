import {
  getLinearDraft,
  listLinearWritesForIssue,
  sqliteToIso,
  type LinearWriteRow,
} from "@otomat/db";
import type { LinearLifecycleSyncState, LinearWritebackState } from "@otomat/domain";

import { draftToContract, writeToContract } from "./contracts.js";
import type { LinearWriteLedger } from "./ledger.js";
import { parseLifecyclePayload } from "./payloads.js";
import type { LinearWritebackConfig } from "./types.js";

/** The newest lifecycle assertion is what the cockpit reports; earlier ones stay in the write history. */
function latestLifecycle(rows: readonly LinearWriteRow[]): LinearLifecycleSyncState | null {
  const row = rows.findLast((candidate) => candidate.kind === "lifecycle");
  if (row === undefined) return null;
  const payload = parseLifecyclePayload(row.payload_json);
  return {
    write_id: row.id,
    phase: payload.phase,
    target_state_id: payload.state_id,
    target_state_name: payload.state_name,
    status: row.status,
    detail: row.detail,
    error_code: row.error_code,
    error_message: row.error_message,
    updated_at: sqliteToIso(row.updated_at),
  };
}

export function writebackState(
  config: LinearWritebackConfig,
  ledger: LinearWriteLedger,
  issueId: string,
): LinearWritebackState {
  const draft = getLinearDraft(config.db, issueId);
  const rows = listLinearWritesForIssue(config.db, issueId).map((row) => ledger.recover(row));
  return {
    draft: draft ? draftToContract(draft) : null,
    writes: rows.map(writeToContract),
    lifecycle: latestLifecycle(rows),
  };
}
