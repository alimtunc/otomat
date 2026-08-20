import { getIssue, type Db, type PullRequestPatch, type RunRow } from "@otomat/db";
import {
  formatCommitSubject,
  type CommitSubject,
  type PullRequestPublicationDetails,
  type PullRequestPublicationMode,
} from "@otomat/domain";

import { normalizePullRequestBody } from "../body.js";
import { pullRequestTitle } from "../conventions/compose.js";
import type { ComposedSubject, PublicationRequest } from "./types.js";

export function issueIdentifier(db: Db, issueId: string): string | null {
  return getIssue(db, issueId)?.source_identifier ?? null;
}

export function composeSubject(subject: CommitSubject, identifier: string | null): ComposedSubject {
  const subjectLine = formatCommitSubject(subject);
  return { subjectLine, title: pullRequestTitle(subjectLine, identifier) };
}

export function resolvePublicationRequest(
  db: Db,
  run: RunRow,
  details: PullRequestPublicationDetails,
  mode: PullRequestPublicationMode,
): PublicationRequest {
  const identifier = issueIdentifier(db, run.issue_id);
  return {
    ...details,
    mode,
    identifier,
    ...composeSubject(details.subject, identifier),
    normalizedBody: normalizePullRequestBody(details.body),
  };
}

export function requestedDetails(request: PublicationRequest): PullRequestPatch {
  return {
    title: request.title,
    body: request.normalizedBody,
    commit_subject: request.subjectLine,
  };
}
