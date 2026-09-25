import { createHash } from "node:crypto";

import { getIssue, type Db } from "@otomat/db";
import type { TerminalPreview, TerminalTool } from "@otomat/domain";

import { TerminalRefusedError } from "./errors.js";

export function terminalContext(
  db: Db,
  issueId: string,
  executable: TerminalTool,
): TerminalPreview {
  const issue = getIssue(db, issueId);
  if (!issue) throw new TerminalRefusedError("Issue not found.");
  const prompt = `Issue: ${issue.source_identifier ?? issue.id}\n${issue.title}\n\n${issue.body ?? ""}`;
  if (prompt.includes("\0") || Buffer.byteLength(prompt) > 8192) {
    throw new TerminalRefusedError(
      "The issue context is too large or contains a null byte. Open a shell and provide the context manually.",
    );
  }
  return {
    executable,
    argv: [prompt],
    context_hash: createHash("sha256").update(executable).update(prompt).digest("hex"),
  };
}
