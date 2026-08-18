import { getIssue, listPullRequestsForIssue, type Db } from "@otomat/db";
import type { PullRequestCandidate, PullRequestDetection } from "@otomat/domain";

import { failureMessage } from "../errors.js";
import type { GitHubCli, GitHubPullRequest } from "../types.js";
import type { IssueRepository } from "./repository.js";
import { buildEvidence, classifyPullRequest } from "./verify.js";

/** GitHub caps a search page anyway; a linked pull request beyond this many matches is imported by hand. */
const CANDIDATE_LIMIT = 10;

export interface DetectionResult {
  candidates: PullRequestCandidate[];
  detection: PullRequestDetection;
}

function unavailable(message: string): DetectionResult {
  return { candidates: [], detection: { status: "unavailable", message } };
}

export interface DetectionConfig {
  db: Db;
  cli: GitHubCli;
  connectedLogin(): Promise<string | null>;
}

/** An issue with no identifier, or a search that could not run, says so: an empty list must never read as "there is none". */
export async function detectIssuePullRequests(
  config: DetectionConfig,
  issueId: string,
  repository: IssueRepository,
): Promise<DetectionResult> {
  const identifier = getIssue(config.db, issueId)?.source_identifier ?? null;
  if (identifier === null) {
    return unavailable(
      "This issue carries no tracker identifier, so GitHub has nothing to link it by. Attach a pull request by number or URL.",
    );
  }

  let found: GitHubPullRequest[];
  try {
    found = await config.cli.searchPullRequests({
      cwd: repository.binding.rootPath,
      repository: repository.remote.repository,
      query: identifier,
      limit: CANDIDATE_LIMIT,
    });
  } catch (error) {
    return unavailable(`GitHub could not be searched for ${identifier}: ${failureMessage(error)}`);
  }

  const attached = new Map(
    listPullRequestsForIssue(config.db, issueId).flatMap((row) =>
      row.number === null ? [] : [[row.number, row.id] as const],
    ),
  );
  const connectedLogin = await config.connectedLogin();
  const candidates = found.map((provider) => ({
    evidence: buildEvidence(repository.remote.repository, provider, "issue_reference"),
    ...classifyPullRequest(config.db, {
      repositoryId: repository.binding.repositoryId,
      provider,
      connectedLogin,
    }),
    attached_pull_request_id: attached.get(provider.number) ?? null,
  }));

  return {
    candidates,
    detection: {
      status: "searched",
      message:
        candidates.length === 0
          ? `No GitHub pull request mentions ${identifier}. Attach one by number or URL if it exists.`
          : `GitHub links ${candidates.length} pull request(s) to ${identifier}.`,
    },
  };
}
