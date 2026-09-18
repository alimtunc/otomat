import type {
  LinearAttachmentContract,
  LinearCommentContract,
  LinearEditorState,
} from "@otomat/domain";

import type { LinearFile } from "../client/types.js";
import { snapshotToContract } from "./contracts.js";
import { requireWritableIssue } from "./issue.js";
import type { LinearWritebackConfig } from "./types.js";

export async function editorState(
  config: LinearWritebackConfig,
  issueId: string,
): Promise<LinearEditorState> {
  const { linearId } = requireWritableIssue(config.db, issueId);
  const { apiKey, signal, run } = config.authorize(issueId);
  const editor = await run(() => config.client.issueEditor(apiKey, linearId, signal));
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
  const { apiKey, signal, run } = config.authorize(issueId);
  const remote = await run(() => config.client.listComments(apiKey, linearId, signal));
  return remote.toSorted((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function attachments(
  config: LinearWritebackConfig,
  issueId: string,
): Promise<LinearAttachmentContract[]> {
  const { linearId } = requireWritableIssue(config.db, issueId);
  const { apiKey, signal, run } = config.authorize(issueId);
  const remote = await run(() => config.client.listAttachments(apiKey, linearId, signal));
  return remote.toSorted((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function media(
  config: LinearWritebackConfig,
  issueId: string,
  url: string,
): Promise<LinearFile> {
  requireWritableIssue(config.db, issueId);
  const { apiKey, signal, run } = config.authorize(issueId);
  return run(() => config.client.downloadFile(apiKey, url, signal));
}
