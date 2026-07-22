import type { ReviewCommentState, ReviewState } from "@otomat/domain";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { runs } from "./runs.js";
import { timestamps } from "./shared.js";

export const reviews = sqliteTable("reviews", {
  id: text("id").primaryKey(),
  run_id: text("run_id")
    .notNull()
    .references(() => runs.id),
  status: text("status").$type<ReviewState>().notNull().default("open"),
  ...timestamps,
});

export const reviewComments = sqliteTable("review_comments", {
  id: text("id").primaryKey(),
  review_id: text("review_id")
    .notNull()
    .references(() => reviews.id),
  file_path: text("file_path").notNull(),
  line: integer("line").notNull(),
  // The immutable file diff SHA keeps the comment anchored to what the reviewer saw.
  diff_sha: text("diff_sha").notNull(),
  body: text("body").notNull(),
  status: text("status").$type<ReviewCommentState>().notNull().default("open"),
  hunk_snapshot: text("hunk_snapshot").notNull().default(""),
  fix_requested_at: text("fix_requested_at"),
  ...timestamps,
});
