import { readPullRequestGenerator, type Db, type RunRow } from "@otomat/db";
import {
  isRunPlanCompeteGroup,
  modelSelectionFromId,
  type PullRequestGeneratorAudit,
} from "@otomat/domain";

import {
  createRuntimeAdapter,
  ModelSelectionRefusedError,
  requireAvailableRuntime,
  resolveModelSelection,
  RuntimeUnavailableError,
  type KnownRuntimeId,
  type RuntimeOneShot,
} from "#runtime";

import { GitHubPublicationError } from "../errors.js";

export interface GenerationAgent extends RuntimeOneShot {
  audit: PullRequestGeneratorAudit;
}

interface RunExecutionSummary {
  runtime: string | null;
  model: string | null;
}

/** The execution the launch froze — what "Same as run" means when no generator is configured. */
function runExecution(run: RunRow): RunExecutionSummary {
  for (const node of run.plan_json.steps) {
    const config = isRunPlanCompeteGroup(node) ? node.compete[0]?.config : node.config;
    if (config) return { runtime: config.runtime, model: config.model?.id ?? null };
  }
  return { runtime: run.agent_id, model: null };
}

function availableRuntime(runtime: string): KnownRuntimeId {
  try {
    return requireAvailableRuntime(runtime);
  } catch (error) {
    if (error instanceof RuntimeUnavailableError) {
      throw new GitHubPublicationError(
        "pr_generator_unavailable",
        `The ${runtime} CLI is not available on this execution host (${error.reason}). Install it, pick another generator in Settings, or write the metadata by hand.`,
      );
    }
    throw new GitHubPublicationError(
      "pr_generator_unavailable",
      `This daemon has no ${runtime} runtime. Pick another generator in Settings, or write the metadata by hand.`,
    );
  }
}

/** Refused rather than sent without the flag: a generation must never quietly run on the CLI's own default model. */
function availableModel(runtime: KnownRuntimeId, model: string | null): string | null {
  try {
    return resolveModelSelection(runtime, modelSelectionFromId(model))?.id ?? null;
  } catch (error) {
    if (error instanceof ModelSelectionRefusedError) {
      throw new GitHubPublicationError(
        "pr_generator_model_unavailable",
        `The ${runtime} CLI on this host does not offer model "${model ?? ""}". Pick an available model in Settings, or write the metadata by hand.`,
      );
    }
    throw error;
  }
}

export function resolveGenerationAgent(db: Db, run: RunRow): GenerationAgent {
  const preference = readPullRequestGenerator(db);
  const inherited = runExecution(run);
  const requested =
    preference.runtime === null
      ? { runtime: inherited.runtime, model: inherited.model, options: {} }
      : { runtime: preference.runtime, model: preference.model, options: preference.options };
  if (requested.runtime === null) {
    throw new GitHubPublicationError(
      "pr_generator_not_configured",
      "This run froze no runtime to inherit. Choose a PR metadata generator in Settings, or write the metadata by hand.",
    );
  }
  const runtime = availableRuntime(requested.runtime);
  const model = availableModel(runtime, requested.model);
  const invocation = createRuntimeAdapter(runtime).describeOneShot?.(model, requested.options);
  if (invocation === undefined) {
    throw new GitHubPublicationError(
      "pr_generator_unsupported_runtime",
      `The ${runtime} runtime has no non-interactive mode Otomat can generate metadata with. Pick another generator in Settings, or write the metadata by hand.`,
    );
  }
  return { ...invocation, audit: { runtime, model, effort: invocation.effort } };
}
