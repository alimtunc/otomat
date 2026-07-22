import type { PublishStatusRequest } from "@otomat/domain";

import { refreshMirror, requireWritableIssue } from "../issue.js";
import type { LinearWriteLedger } from "../ledger.js";
import type { LinearWritebackConfig } from "../types.js";

export async function publishStatus(
  config: LinearWritebackConfig,
  ledger: LinearWriteLedger,
  issueId: string,
  request: PublishStatusRequest,
): Promise<void> {
  const { issue, linearId } = requireWritableIssue(config.db, issueId);
  const key = request.state_id;
  const existing = ledger.findByIdentity(issueId, "status", key);
  if (existing?.status === "sent" || (existing && ledger.isActive(existing))) return;
  const write = ledger.ensurePending(existing, {
    issueId,
    runId: request.run_id ?? null,
    kind: "status",
    key,
    payload: { state_id: request.state_id },
    detail: "Publish status",
  });
  await ledger.run(write, async (apiKey, signal) => {
    const remote = await config.client.issueSnapshot(apiKey, linearId, signal);
    const updated =
      remote.state.id === key
        ? remote
        : await config.client.updateIssue(apiKey, linearId, { stateId: key }, signal);
    refreshMirror(config.db, issue, updated, config.now());
    return { remote_id: updated.external_id, detail: `Status → ${updated.state.name}` };
  });
}
