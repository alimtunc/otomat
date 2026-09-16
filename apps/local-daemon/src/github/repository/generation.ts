import { sourceControlSnapshot } from "#git";

import { resolveGenerationAgent } from "../generation/agent.js";
import { requireGenerator } from "../generation/generator.js";
import { generationInput } from "../generation/input.js";
import type { GitHubServiceConfig } from "../types.js";
import { assertCheckoutRevision, type PreparedRepositoryPublication } from "./workspace.js";

export async function generateRepositoryProposal(
  config: GitHubServiceConfig,
  workspace: PreparedRepositoryPublication,
) {
  const generator = requireGenerator(config.generator);
  const proposal = await generator.generate(
    resolveGenerationAgent(config.db, null),
    generationInput(workspace.cwd, null, workspace.diff),
  );
  assertCheckoutRevision(
    sourceControlSnapshot(workspace.cwd),
    workspace.snapshot.response.revision,
    "The checkout changed during generation. Refresh and generate again.",
  );
  return proposal;
}
