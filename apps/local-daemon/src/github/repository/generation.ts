import { sourceControlSnapshot } from "#git";

import { resolveGenerationAgent } from "../generation/agent.js";
import { requireGenerator } from "../generation/generator.js";
import { generationInput } from "../generation/input.js";
import { traced } from "../generation/trace.js";
import type { GitHubServiceConfig } from "../types.js";
import { assertCheckoutRevision, type PreparedRepositoryPublication } from "./workspace.js";

export function generateRepositoryProposal(
  config: GitHubServiceConfig,
  workspace: PreparedRepositoryPublication,
) {
  const generator = requireGenerator(config.generator);
  return traced(`repository ${workspace.remote.repository}`, async (trace) => {
    const input = generationInput(workspace.cwd, null, workspace.diff);
    trace.step("input", `${String(workspace.diff.files.length)} files`);
    const proposal = await generator.generate(
      resolveGenerationAgent(config.db, null),
      input,
      trace,
    );
    assertCheckoutRevision(
      sourceControlSnapshot(workspace.cwd),
      workspace.snapshot.response.revision,
      "The checkout changed during generation. Refresh and generate again.",
    );
    trace.step("revision");
    return proposal;
  });
}
