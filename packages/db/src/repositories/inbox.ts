import type { InboxPullRequestEvidence } from "@otomat/domain";
import { and, asc, eq, inArray, isNotNull, isNull } from "drizzle-orm";

import type { Db } from "../client.js";
import { issues, projects, pullRequests, repositories } from "../schema/index.js";
import { sqliteToIso } from "./instants.js";
import { LIVE_PULL_REQUEST_STATES } from "./pull-requests.js";

/** Settled pull requests can no longer demand anything; which of the live ones does is the projection’s call, not this read’s. */
export function listInboxPullRequestEvidence(db: Db): InboxPullRequestEvidence[] {
  return db
    .select({
      pullRequest: pullRequests,
      issue: issues,
      project_id: projects.id,
      project_name: projects.name,
    })
    .from(pullRequests)
    .innerJoin(repositories, eq(pullRequests.repository_id, repositories.id))
    .innerJoin(projects, eq(repositories.project_id, projects.id))
    .leftJoin(issues, eq(pullRequests.issue_id, issues.id))
    .where(
      and(
        isNull(pullRequests.detached_at),
        isNotNull(pullRequests.number),
        inArray(pullRequests.status, LIVE_PULL_REQUEST_STATES),
      ),
    )
    .orderBy(asc(pullRequests.created_at))
    .all()
    .map(({ pullRequest: row, issue, ...anchor }) => ({
      pull_request_id: row.id,
      run_id: row.run_id,
      project_id: anchor.project_id,
      project_name: anchor.project_name,
      title: row.title,
      issue: issue === null ? null : { title: issue.title, identifier: issue.source_identifier },
      facts: {
        status: row.status,
        author_login: row.author_login,
        review_decision: row.review_decision,
        checks_state: row.checks_state,
        mergeable: row.mergeable,
        requested_reviewers: row.requested_reviewers,
      },
      updated_at: row.provider_updated_at ?? sqliteToIso(row.updated_at),
    }));
}
