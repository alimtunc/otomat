import type { LinearCommentContract, LinearEditorState } from "@otomat/domain";

import { snapshotToContract } from "./contracts.js";
import { requireWritableIssue } from "./issue.js";
import type { LinearWritebackConfig } from "./types.js";

export async function editorState(
  config: LinearWritebackConfig,
  issueId: string,
): Promise<LinearEditorState> {
  const { linearId } = requireWritableIssue(config.db, issueId);
  const { apiKey, signal } = config.authorize();
  const editor = await config.guard(signal, () =>
    config.client.issueEditor(apiKey, linearId, signal),
  );
  return {
    snapshot: snapshotToContract(editor.issue),
    team_metadata: {
      team_id: editor.team.team_id,
      states: editor.team.states,
      members: editor.team.members,
      labels: editor.team.labels,
    },
  };
}

export async function comments(
  config: LinearWritebackConfig,
  issueId: string,
): Promise<LinearCommentContract[]> {
  const { linearId } = requireWritableIssue(config.db, issueId);
  const { apiKey, signal } = config.authorize();
  const remote = await config.guard(signal, () =>
    config.client.listComments(apiKey, linearId, signal),
  );
  return remote.toSorted((a, b) => a.created_at.localeCompare(b.created_at));
}
