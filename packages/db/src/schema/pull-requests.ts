import type {
  PullRequestChecksState,
  PullRequestMergeability,
  PullRequestOrigin,
  PullRequestProvenance,
  PullRequestPublicationActiveState,
  PullRequestPublicationState,
  PullRequestReviewDecision,
  PullRequestReviewer,
  PullRequestState,
} from "@otomat/domain";
import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { issues } from "./issues.js";
import { runs } from "./runs.js";
import { timestamps } from "./shared.js";
import { repositories } from "./workspace.js";

export const pullRequests = sqliteTable(
  "pull_requests",
  {
    id: text("id").primaryKey(),
    issue_id: text("issue_id").references(() => issues.id),
    /** Null for a pull request Otomat adopted rather than opened: no run of its own ever produced it. */
    run_id: text("run_id").references(() => runs.id),
    repository_id: text("repository_id").references(() => repositories.id),
    provider: text("provider").$type<"github">().notNull().default("github"),
    origin: text("origin").$type<PullRequestOrigin>().notNull().default("otomat"),
    provenance: text("provenance").$type<PullRequestProvenance>().notNull().default("otomat"),
    author_login: text("author_login"),
    review_decision: text("review_decision").$type<PullRequestReviewDecision>(),
    checks_state: text("checks_state").$type<PullRequestChecksState>().notNull().default("none"),
    mergeable: text("mergeable").$type<PullRequestMergeability>().notNull().default("unknown"),
    requested_reviewers: text("requested_reviewers", { mode: "json" })
      .$type<PullRequestReviewer[]>()
      .notNull()
      .default(sql`'[]'`),
    provider_updated_at: text("provider_updated_at"),
    synced_at: text("synced_at"),
    number: integer("number"),
    /** GitHub's GraphQL node id, which the file-viewed mutations address the pull request by. */
    node_id: text("node_id"),
    url: text("url"),
    status: text("status").$type<PullRequestState>().notNull().default("draft"),
    publication_status: text("publication_status")
      .$type<PullRequestPublicationState>()
      .notNull()
      .default("not_configured"),
    /** The phase a stopped publication was in; `publication_status` alone only says that it stopped. */
    failed_phase: text("failed_phase").$type<PullRequestPublicationActiveState>(),
    title: text("title").notNull().default(""),
    body: text("body"),
    head_ref: text("head_ref"),
    base_ref: text("base_ref"),
    head_sha: text("head_sha"),
    base_sha: text("base_sha"),
    commit_subject: text("commit_subject"),
    commit_body: text("commit_body"),
    generator_runtime: text("generator_runtime"),
    generator_model: text("generator_model"),
    generator_effort: text("generator_effort"),
    published_head_sha: text("published_head_sha"),
    published_diff_sha: text("published_diff_sha"),
    attached_at: text("attached_at"),
    attached_by: text("attached_by"),
    attachment_evidence: text("attachment_evidence"),
    detached_at: text("detached_at"),
    error_code: text("error_code"),
    error_message: text("error_message"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("pull_requests_run_id_unique").on(table.run_id),
    uniqueIndex("pull_requests_repository_number_unique")
      .on(table.repository_id, table.number)
      .where(sql`${table.number} is not null and ${table.detached_at} is null`),
  ],
);
