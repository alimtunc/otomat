import type { SkillInvalidReason, SkillSource, SkillStatus } from "@otomat/domain";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { timestamps } from "./shared.js";

export const agents = sqliteTable("agents", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  runtime: text("runtime").notNull(),
  ...timestamps,
});

// Profiles are user-authored; runs freeze their launch snapshot into plan_json.
export const agentProfiles = sqliteTable("agent_profiles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  runtime: text("runtime").notNull(),
  options_json: text("options_json", { mode: "json" }).notNull(),
  guidance: text("guidance"),
  skill_ids_json: text("skill_ids_json", { mode: "json" }).notNull(),
  ...timestamps,
});

// Discovery deduplicates on realpath; skill content is declarative and never executed here.
export const skills = sqliteTable(
  "skills",
  {
    id: text("id").primaryKey(),
    source: text("source").$type<SkillSource>().notNull(),
    canonical_path: text("canonical_path").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    content_hash: text("content_hash"),
    status: text("status").$type<SkillStatus>().notNull().default("available"),
    invalid_reason: text("invalid_reason").$type<SkillInvalidReason>(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (table) => [uniqueIndex("skills_canonical_path_unique").on(table.canonical_path)],
);
