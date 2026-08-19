import {
  commitSubjectViolation,
  type CommitSubject,
  type PullRequestProposal,
} from "@otomat/domain";

import { RuntimeUnavailableError } from "#runtime";

import { commandSucceeded } from "../cli-commands.js";
import { pullRequestBody } from "../conventions/compose.js";
import { GitHubPublicationError } from "../errors.js";
import type { CommandRunner, PullRequestGenerator } from "../types.js";
import type { GenerationAgent } from "./agent.js";
import type { GenerationInput } from "./input.js";
import { parseGenerationOutput, sanitizeBranchName, type GenerationOutput } from "./parse.js";
import { generationPrompt } from "./prompt.js";

const GENERATION_TIMEOUT_MS = 180_000;

/** Refused before any commit or push: an invalid proposal leaves the fields editable and publishes nothing. */
function compose(
  output: GenerationOutput,
  input: GenerationInput,
  agent: GenerationAgent,
): PullRequestProposal {
  const subject: CommitSubject = {
    type: output.type,
    scope: output.scope ?? null,
    summary: output.summary,
  };
  const violation = commitSubjectViolation(subject);
  if (violation !== null) throw new GitHubPublicationError("pr_generation_invalid", violation);
  const branch = sanitizeBranchName(output.branch);
  if (branch === null) {
    throw new GitHubPublicationError(
      "pr_generation_invalid",
      "The agent proposed an unusable branch name.",
    );
  }
  return {
    subject,
    body: pullRequestBody(output.body, input.issue.identifier, output.delivery),
    branch,
    commit_body: output.commit_body ?? null,
    generator: agent.audit,
  };
}

export function createPullRequestGenerator(run: CommandRunner): PullRequestGenerator {
  return {
    async generate(agent: GenerationAgent, input: GenerationInput): Promise<PullRequestProposal> {
      try {
        agent.preflight?.(input.cwd);
      } catch (error) {
        if (error instanceof RuntimeUnavailableError) {
          throw new GitHubPublicationError("pr_generator_unavailable", error.message);
        }
        throw error;
      }
      const result = await run({
        command: agent.command,
        args: agent.args,
        cwd: input.cwd,
        stdin: generationPrompt(input),
        timeoutMs: GENERATION_TIMEOUT_MS,
      });
      if (result.errorCode === "timed_out") {
        throw new GitHubPublicationError(
          "pr_generation_failed",
          `The ${agent.audit.runtime} CLI did not answer within ${String(GENERATION_TIMEOUT_MS / 1000)} seconds.`,
        );
      }
      if (!commandSucceeded(result)) {
        const detail = result.stderr.trim().split("\n").at(-1) || (result.errorCode ?? "");
        throw new GitHubPublicationError(
          "pr_generation_failed",
          `The ${agent.audit.runtime} CLI could not write the pull request${detail === "" ? "." : ` (${detail.slice(0, 200)})`}`,
        );
      }
      return compose(parseGenerationOutput(result.stdout), input, agent);
    },
  };
}
