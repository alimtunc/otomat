import { findPullRequestByNumber, getRepository, listRuns, type Db } from "@otomat/db";
import type { PullRequestDiscovery, PullRequestEvidence } from "@otomat/domain";

import type { GitHubPullRequest } from "../types.js";
import { classifyProvenance, type ProvenanceVerdict } from "./provenance.js";

export function buildEvidence(
  repository: string,
  provider: GitHubPullRequest,
  discovery: PullRequestDiscovery,
): PullRequestEvidence {
  return {
    repository,
    number: provider.number,
    base_ref: provider.baseRef,
    head_ref: provider.headRef,
    head_sha: provider.headSha,
    author_login: provider.authorLogin,
    status: provider.lifecycle,
    discovery,
    verified_at: new Date().toISOString(),
  };
}

export interface ClassificationInput {
  repositoryId: string;
  provider: GitHubPullRequest;
  connectedLogin: string | null;
}

/** Reads the local facts a provenance may rest on — Otomat's own publication, and the branches its runs own — before judging. */
export function classifyPullRequest(db: Db, input: ClassificationInput): ProvenanceVerdict {
  const stored = findPullRequestByNumber(db, input.repositoryId, input.provider.number);
  const repository = getRepository(db, input.repositoryId);
  if (!repository) throw new Error(`repository ${input.repositoryId} vanished while classifying`);
  return classifyProvenance({
    provider: input.provider,
    otomatBranches: listRuns(db, { projectId: repository.project_id }).map((run) => run.branch),
    otomatPublication: stored?.origin === "otomat",
    connectedLogin: input.connectedLogin,
  });
}
