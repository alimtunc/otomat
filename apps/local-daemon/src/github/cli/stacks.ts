import type { PullRequestStack, PullRequestState } from "@otomat/domain";
import { z } from "zod";

import { GitHubCliError } from "../errors.js";
import { parseGitHubJson } from "../parse.js";
import type { CommandRunner } from "../types.js";
import { assertPublicationSucceeded } from "./commands.js";
import type { PullRequestTarget } from "./contract.js";

const stackListingSchema = z.array(z.object({ number: z.number().int().positive() })).max(1);
const branchSchema = z.object({ ref: z.string().min(1) });
const stackDetailSchema = z.object({
  number: z.number().int().positive(),
  base: branchSchema,
  pull_requests: z
    .array(
      z.object({
        number: z.number().int().positive(),
        title: z.string(),
        html_url: z.url({ protocol: /^https?$/ }),
        state: z.enum(["open", "closed"]),
        draft: z.boolean(),
        merged_at: z.string().nullable(),
        head: branchSchema,
        base: branchSchema,
      }),
    )
    .min(1),
});

export async function readPullRequestStack(
  run: CommandRunner,
  input: PullRequestTarget,
): Promise<PullRequestStack | null> {
  const get = async (path: string): Promise<string> => {
    const result = await run({
      command: "gh",
      args: ["api", path, "--method", "GET", "-H", "X-GitHub-Api-Version: 2026-03-10"],
      cwd: input.cwd,
    });
    assertPublicationSucceeded(
      result,
      "github_stack_unavailable",
      "GitHub stacks could not be read. Check repository access and stack API availability.",
    );
    return result.stdout;
  };
  const matches = parseGitHubJson(
    await get(`repos/${input.repository}/stacks?pull_request=${input.number}&per_page=2`),
    (value) => stackListingSchema.parse(value),
    "github_stack_invalid",
    "GitHub returned an ambiguous stack membership.",
  );
  const match = matches[0];
  if (match === undefined) return null;
  const stack = parseGitHubJson(
    await get(`repos/${input.repository}/stacks/${match.number}`),
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
    members: stack.pull_requests.map((member) => {
      let status: PullRequestState = member.draft ? "draft" : "open";
      if (member.state === "closed") status = "closed";
      if (member.merged_at !== null) status = "merged";
      return {
        number: member.number,
        title: member.title,
        url: member.html_url,
        status,
        head_ref: member.head.ref,
        base_ref: member.base.ref,
      };
    }),
  };
}
