import type {
  DiffSide,
  ReviewCommentDestination,
  ReviewCommentPublicationState,
  ReviewCommentState,
  ReviewState,
} from "@otomat/domain";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { timestamps } from "./shared.js";

export const reviews = sqliteTable("reviews", {
  id: text("id").primaryKey(),
  /** A run id or a pull request id: the two things that own a diff. Polymorphic, so no foreign key. */
  subject_id: text("subject_id").notNull(),
  status: text("status").$type<ReviewState>().notNull().default("open"),
  ...timestamps,
});

export const reviewComments = sqliteTable("review_comments", {
  id: text("id").primaryKey(),
  review_id: text("review_id")
    .notNull()
    .references(() => reviews.id),
  file_path: text("file_path").notNull(),
  side: text("side").$type<DiffSide>().notNull().default("new"),
  start_line: integer("start_line"),
  line: integer("line"),
  diff_sha: text("diff_sha").notNull(),
  body: text("body").notNull(),
  status: text("status").$type<ReviewCommentState>().notNull().default("open"),
  destination: text("destination").$type<ReviewCommentDestination>().notNull().default("agent"),
  publication_status: text("publication_status")
    .$type<ReviewCommentPublicationState>()
    .notNull()
    .default("local"),
  publication_error: text("publication_error"),
  external_url: text("external_url"),
  suggestion: text("suggestion"),
  suggestion_original: text("suggestion_original"),
  hunk_snapshot: text("hunk_snapshot").notNull().default(""),
  fix_requested_at: text("fix_requested_at"),
  // Deliberately not a foreign key: this evidence outlives whatever happens to the session row.
  fixed_by_session_id: text("fixed_by_session_id"),
  ...timestamps,
});
