import { getIssue, listPullRequestsForIssue, listRuns, type Db } from "@otomat/db";
import {
  matchIssueReference,
  type PullRequestCandidate,
  type PullRequestDetection,
} from "@otomat/domain";

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

function searchedMessage(identifier: string, candidates: readonly PullRequestCandidate[]): string {
  if (candidates.length === 0) {
    return `No pull request names ${identifier} in its title or body. Attach one by number or URL if it exists.`;
  }
  const offered = candidates.filter((candidate) => candidate.attached_pull_request_id === null);
  if (offered.length === 0) return `Every pull request naming ${identifier} is already attached.`;
  return `${offered.length} pull request(s) naming ${identifier} are not attached. Confirm one to attach it.`;
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
      identifier,
      limit: CANDIDATE_LIMIT,
    });
  } catch (error) {
    return unavailable(`GitHub could not be searched for ${identifier}: ${failureMessage(error)}`);
  }

  const repositoryId = repository.binding.repositoryId;
  const issueRows = listPullRequestsForIssue(config.db, issueId);
  const attached = new Map(
    issueRows.flatMap((row) =>
      row.number === null || row.repository_id !== repositoryId
        ? []
        : [[row.number, row.id] as const],
    ),
  );
  const workspacePublications = new Set(
    issueRows.flatMap((row) =>
      row.number !== null && row.origin === "otomat" && row.repository_id === repositoryId
        ? [row.number]
        : [],
    ),
  );
  const workspaceBranches = new Set(listRuns(config.db, { issueId }).map((run) => run.branch));
  const connectedLogin = await config.connectedLogin();
  const candidates = found.flatMap((provider): PullRequestCandidate[] => {
    const reference = matchIssueReference(identifier, {
      title: provider.title,
      body: provider.body,
      branch: provider.headRef,
    });
    if (reference === null) return [];
    return [
      {
        evidence: buildEvidence(repository.remote.repository, provider, "issue_reference"),
        reference,
        ...classifyPullRequest(config.db, { repositoryId, provider, connectedLogin }),
        workspace_owned:
          workspacePublications.has(provider.number) || workspaceBranches.has(provider.headRef),
        attached_pull_request_id: attached.get(provider.number) ?? null,
      },
    ];
  });

  return {
    candidates,
    detection: { status: "searched", message: searchedMessage(identifier, candidates) },
  };
}
