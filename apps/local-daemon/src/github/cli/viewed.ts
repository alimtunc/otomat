import { z } from "zod";

import { GitHubCliError } from "../errors.js";
import type { CommandRunner, ViewedFileMutationInput, ViewedFilesInput } from "../types.js";
import {
  VIEWER_VIEWED_STATES,
  type PullRequestViewedFile,
  type PullRequestViewedFiles,
} from "../viewed-state.js";
import { assertPublicationSucceeded } from "./commands.js";

const VIEWED_PAGE_SIZE = 100;
/** GitHub itself stops reporting a pull request's files at 3000, so this is its ceiling, not a sample. */
const VIEWED_PAGE_LIMIT = 30;

const VIEWED_FILES_QUERY = `query($owner:String!,$name:String!,$number:Int!,$after:String){repository(owner:$owner,name:$name){pullRequest(number:$number){id files(first:${VIEWED_PAGE_SIZE},after:$after){pageInfo{hasNextPage endCursor}nodes{path viewerViewedState}}}}}`;

const MARK_VIEWED_MUTATION = `mutation($id:ID!,$path:String!){markFileAsViewed(input:{pullRequestId:$id,path:$path}){clientMutationId}}`;
const UNMARK_VIEWED_MUTATION = `mutation($id:ID!,$path:String!){unmarkFileAsViewed(input:{pullRequestId:$id,path:$path}){clientMutationId}}`;

const viewedFilesPageSchema = z.object({
  data: z.object({
    repository: z.object({
      pullRequest: z.object({
        id: z.string().min(1),
        files: z.object({
          pageInfo: z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullish() }),
          nodes: z.array(
            z.object({
              path: z.string().min(1),
              viewerViewedState: z.enum(VIEWER_VIEWED_STATES),
            }),
          ),
        }),
      }),
    }),
  }),
});

function repositoryVariables(repository: string): string[] {
  const [owner = "", name = ""] = repository.split("/");
  return ["-f", `owner=${owner}`, "-f", `name=${name}`];
}

function parsePage(stdout: string): z.infer<typeof viewedFilesPageSchema> {
  try {
    return viewedFilesPageSchema.parse(JSON.parse(stdout));
  } catch {
    throw new GitHubCliError(
      "github_viewed_files_unreadable",
      "GitHub returned viewed state Otomat could not read.",
    );
  }
}

/** Paginated, and refuses a partial answer: a truncated read would report the tail of the diff as unreviewed. */
export async function listViewedFiles(
  run: CommandRunner,
  input: ViewedFilesInput,
): Promise<PullRequestViewedFiles> {
  const files: PullRequestViewedFile[] = [];
  let cursor: string | null = null;
  let nodeId = "";
  let truncated = false;

  for (let page = 0; page < VIEWED_PAGE_LIMIT; page += 1) {
    const result = await run({
      command: "gh",
      args: [
        "api",
        "graphql",
        "-f",
        `query=${VIEWED_FILES_QUERY}`,
        ...repositoryVariables(input.repository),
        "-F",
        `number=${input.number}`,
        ...(cursor === null ? [] : ["-f", `after=${cursor}`]),
      ],
      cwd: input.cwd,
    });
    assertPublicationSucceeded(
      result,
      "github_viewed_files_failed",
      "GitHub could not report which files you have viewed.",
    );
    const pullRequest = parsePage(result.stdout).data.repository.pullRequest;
    nodeId = pullRequest.id;
    for (const node of pullRequest.files.nodes) {
      files.push({ path: node.path, state: node.viewerViewedState });
    }
    cursor = pullRequest.files.pageInfo.endCursor ?? null;
    truncated = pullRequest.files.pageInfo.hasNextPage;
    if (!truncated || cursor === null) break;
  }

  if (truncated) {
    throw new GitHubCliError(
      "github_viewed_files_truncated",
      `This pull request carries more than ${VIEWED_PAGE_SIZE * VIEWED_PAGE_LIMIT} files, more than GitHub will report Viewed state for.`,
    );
  }
  return { nodeId, files };
}

export async function setFileViewed(
  run: CommandRunner,
  input: ViewedFileMutationInput,
): Promise<void> {
  const result = await run({
    command: "gh",
    args: [
      "api",
      "graphql",
      "-f",
      `query=${input.viewed ? MARK_VIEWED_MUTATION : UNMARK_VIEWED_MUTATION}`,
      "-f",
      `id=${input.pullRequestNodeId}`,
      "-f",
      `path=${input.path}`,
    ],
    cwd: input.cwd,
  });
  assertPublicationSucceeded(
    result,
    "github_viewed_file_failed",
    `GitHub refused to mark ${input.path} as ${input.viewed ? "viewed" : "not viewed"}.`,
  );
}
