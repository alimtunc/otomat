import { randomUUID } from "node:crypto";

import type { Db } from "@otomat/db";
import {
  isRunPlanCompeteGroup,
  type ResolvedAgentConfig,
  type RunPlan,
  type RunPlanNodeInput,
  type StartRunRequest,
} from "@otomat/domain";

import { resolveAgentConfig, type AgentConfigSelector } from "#agents";

const STEP_NAME = "Agent turn";

function mappedStepId(idByRequestId: ReadonlyMap<string, string>, requestId: string): string {
  const mapped = idByRequestId.get(requestId);
  if (mapped === undefined) throw new Error(`plan references unknown step id ${requestId}`);
  return mapped;
}

/** A per-node selector: its own profile, its own ad-hoc runtime, or `null` to inherit the run default. */
function nodeSelector(node: {
  agent: string | null;
  profile_id?: string | null;
}): AgentConfigSelector | null {
  if (node.profile_id) return { kind: "profile", profileId: node.profile_id };
  if (node.agent) return { kind: "runtime", runtimeId: node.agent };
  return null;
}

function configForNode(
  db: Db,
  selector: AgentConfigSelector | null,
  defaultConfig: ResolvedAgentConfig,
  env: NodeJS.ProcessEnv,
): ResolvedAgentConfig {
  return selector === null ? defaultConfig : resolveAgentConfig(db, selector, env);
}

function freezeNode(
  db: Db,
  node: RunPlanNodeInput,
  idByRequestId: ReadonlyMap<string, string>,
  defaultConfig: ResolvedAgentConfig,
  env: NodeJS.ProcessEnv,
) {
  const dependencies = node.depends_on.map((dependency) => mappedStepId(idByRequestId, dependency));
  if ("compete" in node) {
    return {
      id: mappedStepId(idByRequestId, node.id),
      name: node.name,
      depends_on: dependencies,
      compete: node.compete.map((competitor) => {
        const config = configForNode(db, nodeSelector(competitor), defaultConfig, env);
        return {
          id: mappedStepId(idByRequestId, competitor.id),
          name: competitor.name,
          agent: config.runtime,
          prompt: `Shared objective:\n${node.name}\n\nCandidate instructions:\n${competitor.prompt}`,
          config,
        };
      }),
    };
  }
  const config = configForNode(db, nodeSelector(node), defaultConfig, env);
  return {
    id: mappedStepId(idByRequestId, node.id),
    name: node.name,
    agent: config.runtime,
    prompt: node.prompt,
    depends_on: dependencies,
    config,
  };
}

/**
 * Freezes the launch plan: request-local ids become the generated `step_runs`
 * ids (plan step id == step_run id), and each node's effective agent config
 * (runtime, options, guidance, skills, provenance/hash) is resolved and embedded
 * so resume/follow-up/fix read the frozen snapshot, never the live profile.
 */
export function freezePlan(
  db: Db,
  request: StartRunRequest,
  defaultConfig: ResolvedAgentConfig,
  env: NodeJS.ProcessEnv,
  fallbackPrompt: string,
): RunPlan {
  if (!request.plan) {
    return {
      version: 1,
      steps: [
        {
          id: randomUUID(),
          name: STEP_NAME,
          agent: defaultConfig.runtime,
          prompt: fallbackPrompt,
          depends_on: [],
          config: defaultConfig,
        },
      ],
    };
  }

  const idByRequestId = new Map<string, string>();
  for (const node of request.plan.steps) {
    idByRequestId.set(node.id, randomUUID());
    if (isRunPlanCompeteGroup(node)) {
      for (const competitor of node.compete) idByRequestId.set(competitor.id, randomUUID());
    }
  }
  return {
    version: 1,
    steps: request.plan.steps.map((node) =>
      freezeNode(db, node, idByRequestId, defaultConfig, env),
    ),
  };
}
