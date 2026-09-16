import type { CommitFilesRequest, CommitFilesResponse } from "@otomat/domain";

import { runGit } from "../git-cli.js";
import { headSha } from "../repo.js";
import { SourceControlError } from "./errors.js";
import { sourceControlSnapshot } from "./snapshot.js";

export function commitCheckoutFiles(cwd: string, request: CommitFilesRequest): CommitFilesResponse {
  const snapshot = sourceControlSnapshot(cwd);
  if (snapshot.conflicted)
    throw new SourceControlError(
      "checkout_conflicted",
      "Resolve merge conflicts before committing.",
    );
  if (snapshot.response.revision !== request.revision)
    throw new SourceControlError(
      "checkout_stale",
      "The checkout changed. Refresh before committing.",
    );
  if (snapshot.response.branch === "HEAD")
    throw new SourceControlError("change_unavailable", "Check out a branch before committing.");
  if (snapshot.response.staged.length === 0)
    throw new SourceControlError("change_unavailable", "Stage changes before committing.");
  const result = runGit(["commit", "--file=-"], {
    cwd,
    input: request.message,
    allowFailure: true,
    timeoutMs: 120_000,
  });
  if (result.exitCode !== 0)
    throw new SourceControlError(
      "commit_failed",
      result.stderr.trim() || result.stdout.trim() || "Git could not create the commit.",
    );
  return { sha: headSha(cwd) };
}
