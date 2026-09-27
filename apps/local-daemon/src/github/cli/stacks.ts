import type { PullRequestStack, PullRequestStackMember } from "@otomat/domain";
import { z } from "zod";

import { GitHubCliError } from "../errors.js";
import { lifecycle, parseGitHubJson } from "../parse.js";
import type { CommandRunner } from "../types.js";
import { assertPublicationSucceeded } from "./commands.js";
import type { PullRequestTarget } from "./contract.js";

const stackListingSchema = z.array(z.object({ number: z.number().int().positive() })).max(1);
const branchSchema = z.object({ ref: z.string().min(1) });
const stackMemberSchema = z.object({
  number: z.number().int().positive(),
  title: z.string(),
  html_url: z.url({ protocol: /^https?$/ }),
  state: z.enum(["open", "closed"]),
  draft: z.boolean(),
  merged_at: z.string().nullable(),
  head: branchSchema,
  base: branchSchema,
});
const stackDetailSchema = z.object({
  number: z.number().int().positive(),
  base: branchSchema,
  pull_requests: z.array(stackMemberSchema).min(1),
});

async function ghApiGet(run: CommandRunner, cwd: string, path: string): Promise<string> {
  const result = await run({
    command: "gh",
    args: ["api", path, "-H", "X-GitHub-Api-Version: 2026-03-10"],
    cwd,
  });
  assertPublicationSucceeded(
    result,
    "github_stack_unavailable",
    "GitHub stacks could not be read. Check repository access and stack API availability.",
  );
  return result.stdout;
}

const REST_STATE = { open: "OPEN", closed: "CLOSED" } as const;

function toStackMember(member: z.infer<typeof stackMemberSchema>): PullRequestStackMember {
  return {
    number: member.number,
    title: member.title,
    url: member.html_url,
    status: lifecycle(
      member.merged_at === null ? REST_STATE[member.state] : "MERGED",
      member.draft,
    ),
    head_ref: member.head.ref,
    base_ref: member.base.ref,
  };
}

export async function readPullRequestStack(
  run: CommandRunner,
  input: PullRequestTarget,
): Promise<PullRequestStack | null> {
  const matches = parseGitHubJson(
    await ghApiGet(
      run,
      input.cwd,
      `repos/${input.repository}/stacks?pull_request=${input.number}&per_page=2`,
    ),
    (value) => stackListingSchema.parse(value),
    "github_stack_invalid",
    "GitHub returned an ambiguous stack membership.",
  );
  const match = matches[0];
  if (match === undefined) return null;
  const stack = parseGitHubJson(
    await ghApiGet(run, input.cwd, `repos/${input.repository}/stacks/${match.number}`),
    (value) => stackDetailSchema.parse(value),
    "github_stack_invalid",
    "GitHub returned an incomplete stack.",
  );
  const numbers = stack.pull_requests.map((member) => member.number);
  if (
    stack.number !== match.number ||
    !numbers.includes(input.number) ||
    new Set(numbers).size !== numbers.length
  ) {
    throw new GitHubCliError(
      "github_stack_invalid",
      "The stack changed while it was read. Refresh to try again.",
    );
  }
  return {
    number: stack.number,
    base_ref: stack.base.ref,
    members: stack.pull_requests.map(toStackMember),
  };
}
