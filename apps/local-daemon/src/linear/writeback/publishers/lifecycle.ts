import type { LinearLifecyclePhase } from "@otomat/domain";

import { refreshMirror, requireWritableIssue } from "../issue.js";
import type { LinearWriteLedger } from "../ledger.js";
import type { LinearWritebackConfig, PublishLifecycleRequest } from "../types.js";

const PHASE_LABEL = {
  in_progress: "In Progress",
  done: "Done",
} satisfies Record<LinearLifecyclePhase, string>;

export async function publishLifecycle(
  config: LinearWritebackConfig,
  ledger: LinearWriteLedger,
  issueId: string,
  request: PublishLifecycleRequest,
): Promise<void> {
  const { issue, linearId } = requireWritableIssue(config.db, issueId);
  const existing = request.key
    ? ledger.findByIdentity(issueId, "lifecycle", request.key)
    : undefined;
  if (existing && ledger.isActive(existing)) return;
  const label = PHASE_LABEL[request.phase];
  const write = ledger.ensurePending(existing, {
    issueId,
    runId: request.run_id,
    kind: "lifecycle",
    key: request.key ?? config.idFactory(),
    payload: {
      phase: request.phase,
      state_id: request.target.id,
      state_name: request.target.name,
    },
    detail: `${label} → ${request.target.name}`,
  });
  await ledger.run(write, async (apiKey, signal) => {
    const remote = await config.client.issueSnapshot(apiKey, linearId, signal);
    const updated =
      remote.state.id === request.target.id
        ? remote
        : await config.client.updateIssue(apiKey, linearId, { stateId: request.target.id }, signal);
    refreshMirror(config.db, issue, updated, config.now());
    return { remote_id: updated.external_id, detail: `${label} → ${updated.state.name}` };
  });
}
