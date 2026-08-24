import type { PullRequestRow } from "@otomat/db";
import {
  pullRequestContractSchema,
  pullRequestEvidenceSchema,
  pullRequestReviewContextSchema,
  type PullRequestAttachment,
  type PullRequestContract,
  type PullRequestIssueLink,
  type PullRequestReviewContext,
} from "@otomat/domain";

/** A row carries its evidence as stored JSON; parsing it strictly means a corrupt audit is reported, never shown as "no evidence". */
function toAttachment(row: PullRequestRow): PullRequestAttachment | null {
  if (row.attached_at === null || row.attachment_evidence === null) return null;
  return {
    attached_at: row.attached_at,
    attached_by: row.attached_by,
    evidence: pullRequestEvidenceSchema.parse(JSON.parse(row.attachment_evidence)),
  };
}

export function toPullRequest(row: PullRequestRow): PullRequestContract {
  return pullRequestContractSchema.parse({
    id: row.id,
    issue_id: row.issue_id,
    run_id: row.run_id,
    provider: row.provider,
    origin: row.origin,
    provenance: row.provenance,
    author_login: row.author_login,
    review_decision: row.review_decision,
    checks_state: row.checks_state,
    mergeable: row.mergeable,
    requested_reviewers: row.requested_reviewers,
    provider_updated_at: row.provider_updated_at,
    head_sha: row.head_sha,
    attachment: toAttachment(row),
    number: row.number,
    url: row.url,
    status: row.status,
    publication_status: row.publication_status,
    title: row.title,
    body: row.body,
    head_ref: row.head_ref,
    base_ref: row.base_ref,
    commit_subject: row.commit_subject,
    commit_body: row.commit_body,
    generator:
      row.generator_runtime === null
        ? null
        : {
            runtime: row.generator_runtime,
            model: row.generator_model,
            effort: row.generator_effort,
          },
    published_head_sha: row.published_head_sha,
    published_diff_sha: row.published_diff_sha,
    error_code: row.error_code,
    error_message: row.error_message,
  });
}

export function toPullRequestReviewContext(
  row: PullRequestRow,
  issue: PullRequestIssueLink | null,
): PullRequestReviewContext {
  return pullRequestReviewContextSchema.parse({ pull_request: toPullRequest(row), issue });
}
