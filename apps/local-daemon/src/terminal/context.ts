import { createHash } from "node:crypto";

import { getIssue, type Db } from "@otomat/db";
import { terminalToolSchema, type TerminalPreview } from "@otomat/domain";

import { WorktreeConflictError } from "#git";

export function terminalContext(db: Db, issueId: string, tool: unknown): TerminalPreview {
  const executable = terminalToolSchema.parse(tool);
  const issue = getIssue(db, issueId);
  if (!issue) throw new WorktreeConflictError("Issue not found.");
  const prompt = `Issue: ${issue.source_identifier ?? issue.id}\n${issue.title}\n\n${issue.body ?? ""}`;
  if (prompt.includes("\0") || Buffer.byteLength(prompt) > 8192) {
    throw new WorktreeConflictError(
      "The issue context is too large or contains a null byte. Open a shell and provide the context manually.",
    );
  }
  return {
    executable,
    argv: [prompt],
    context_hash: createHash("sha256").update(executable).update(prompt).digest("hex"),
  };
}
