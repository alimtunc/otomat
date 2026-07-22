import type { PullRequestPublicationState, PullRequestState } from "@otomat/domain";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { runs } from "./runs.js";
import { timestamps } from "./shared.js";

export const pullRequests = sqliteTable(
  "pull_requests",
  {
    id: text("id").primaryKey(),
    run_id: text("run_id")
      .notNull()
      .references(() => runs.id),
    provider: text("provider").$type<"github">().notNull().default("github"),
    number: integer("number"),
    url: text("url"),
    status: text("status").$type<PullRequestState>().notNull().default("draft"),
    publication_status: text("publication_status")
      .$type<PullRequestPublicationState>()
      .notNull()
      .default("not_configured"),
    title: text("title").notNull().default(""),
    body: text("body"),
    head_ref: text("head_ref"),
    base_ref: text("base_ref"),
    published_head_sha: text("published_head_sha"),
    published_diff_sha: text("published_diff_sha"),
    error_code: text("error_code"),
    error_message: text("error_message"),
    ...timestamps,
  },
  (table) => [uniqueIndex("pull_requests_run_id_unique").on(table.run_id)],
);
