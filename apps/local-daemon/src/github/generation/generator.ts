import {
  commitSubjectViolation,
  PR_GENERATION_INVALID_CODE,
  shortenCommitSummary,
  type CommitSubject,
  type CommitSubjectDraft,
  type PullRequestProposal,
} from "@otomat/domain";

import { RuntimeUnavailableError } from "#runtime";

import { commandSucceeded } from "../cli/commands.js";
import { pullRequestBody } from "../conventions/compose.js";
import { GitHubPublicationError } from "../errors.js";
import type { CommandRunner, PullRequestGenerator } from "../types.js";
import type { GenerationAgent } from "./agent.js";
import type { GenerationInput } from "./input.js";
import { parseGenerationOutput, sanitizeBranchName, type GenerationOutput } from "./parse.js";
import { correctionPrompt, generationPrompt } from "./prompt.js";

const GENERATION_TIMEOUT_MS = 180_000;

function proposedSubject(output: GenerationOutput): CommitSubjectDraft {
  return { type: output.type, scope: output.scope ?? null, summary: output.summary };
}

/** The subject the contract accepts, or the sentence it refused with. */
function acceptedSubject(subject: CommitSubjectDraft): CommitSubject | string {
  const violation = commitSubjectViolation(subject);
  if (violation === null) return subject;
  const summary = shortenCommitSummary(subject);
  if (summary === null) return violation;
  const shortened = { ...subject, summary };
  return commitSubjectViolation(shortened) ?? shortened;
}

function compose(
  output: GenerationOutput,
  subject: CommitSubject,
  input: GenerationInput,
  agent: GenerationAgent,
): PullRequestProposal {
  const branch = sanitizeBranchName(output.branch);
  if (branch === null) {
    throw new GitHubPublicationError(
      PR_GENERATION_INVALID_CODE,
      "The agent proposed an unusable branch name.",
    );
  }
  return {
    subject,
    body: pullRequestBody(output.body, input.issue.sourceIdentifier, output.delivery),
    branch,
    commit_body: output.commit_body ?? null,
    generator: agent.audit,
  };
}

export function createPullRequestGenerator(run: CommandRunner): PullRequestGenerator {
  const invoke = async (
    agent: GenerationAgent,
    cwd: string,
    prompt: string,
  ): Promise<GenerationOutput> => {
    const result = await run({
      command: agent.command,
      args: agent.args,
      cwd,
      stdin: prompt,
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
    return parseGenerationOutput(result.stdout);
  };

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
      const first = await invoke(agent, input.cwd, generationPrompt(input));
      const proposed = proposedSubject(first);
      const repaired = acceptedSubject(proposed);
      if (typeof repaired !== "string") return compose(first, repaired, input, agent);

      const retried = await invoke(agent, input.cwd, correctionPrompt(input, proposed, repaired));
      const accepted = acceptedSubject(proposedSubject(retried));
      if (typeof accepted === "string") {
        throw new GitHubPublicationError(PR_GENERATION_INVALID_CODE, accepted);
      }
      return compose(retried, accepted, input, agent);
    },
  };
}
