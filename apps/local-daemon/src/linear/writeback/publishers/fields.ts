import { deleteLinearDraft, getLinearDraft } from "@otomat/db";
import type { PublishFieldsRequest } from "@otomat/domain";

import { linearError, LinearWriteConflictError } from "#linear/errors";

import { snapshotToContract } from "../contracts.js";
import { draftMatchesPayload, draftMatchesRemote, fieldChanges, fieldsPayload } from "../fields.js";
import { refreshMirror, requireWritableIssue } from "../issue.js";
import type { LinearWriteLedger } from "../ledger.js";
import type { LinearWritebackConfig } from "../types.js";

export async function publishFields(
  config: LinearWritebackConfig,
  ledger: LinearWriteLedger,
  issueId: string,
  request: PublishFieldsRequest,
): Promise<void> {
  const { issue, linearId } = requireWritableIssue(config.db, issueId);
  const draft = getLinearDraft(config.db, issueId);
  if (!draft) throw linearError("linear_write_not_found");
  const key = draft.id;
  const existing = ledger.findByIdentity(issueId, "fields", key);
  if (existing?.status === "sent") {
    if (draftMatchesPayload(draft, existing.payload_json)) {
      deleteLinearDraft(config.db, issueId);
    }
    return;
  }
  if (existing && ledger.isActive(existing)) return;
  const write = ledger.ensurePending(existing, {
    issueId,
    runId: null,
    kind: "fields",
    key,
    payload: fieldsPayload(draft),
    detail: "Publish fields",
  });
  await ledger.run(write, async (apiKey, signal) => {
    const remote = await config.client.issueSnapshot(apiKey, linearId, signal);
    if (draftMatchesRemote(draft, remote)) {
      refreshMirror(config.db, issue, remote, config.now());
      return { remote_id: remote.updated_at, detail: "Already up to date on Linear" };
    }
    if (remote.updated_at !== draft.base_updated_at && !request.overwrite) {
      throw new LinearWriteConflictError(snapshotToContract(remote));
    }
    const changes = fieldChanges(draft, remote);
    const updated =
      Object.keys(changes).length === 0
        ? remote
        : await config.client.updateIssue(apiKey, linearId, changes, signal);
    refreshMirror(config.db, issue, updated, config.now());
    return { remote_id: updated.updated_at, detail: "Published fields to Linear" };
  });
  deleteLinearDraft(config.db, issueId);
}
