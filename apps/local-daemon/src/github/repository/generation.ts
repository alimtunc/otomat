import { sourceControlSnapshot } from "#git";

import { GitHubPublicationError } from "../errors.js";
import { resolveGenerationAgent } from "../generation/agent.js";
import type { GitHubServiceConfig } from "../types.js";
import type { RepositoryPublicationWorkspace } from "./workspace.js";

export async function generateRepositoryProposal(
  config: GitHubServiceConfig,
  workspace: RepositoryPublicationWorkspace,
) {
  if (config.generator === undefined)
    throw new GitHubPublicationError(
      "pr_generation_unavailable",
      "This daemon runs no metadata generator; write the title and description by hand.",
    );
  const proposal = await config.generator.generate(resolveGenerationAgent(config.db, null), {
    cwd: workspace.cwd,
    issue: null,
    diffStat: workspace.diff.files.map(
      (file) => `${file.path} +${file.additions} -${file.deletions}`,
    ),
    patch: workspace.diff.files.map((file) => file.patch).join("\n"),
  });
  if (
    sourceControlSnapshot(workspace.cwd).response.revision !== workspace.snapshot.response.revision
  )
    throw new GitHubPublicationError(
      "checkout_stale",
      "The checkout changed during generation. Refresh and generate again.",
    );
  return proposal;
}
