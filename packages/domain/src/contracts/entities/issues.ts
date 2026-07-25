import { z } from "zod";

import { ISSUE_STATES } from "../entity-states.js";
import { issueExecutionSchema } from "./issue-execution.js";

const EXTERNAL_ISSUE_SOURCES = ["linear", "github"] as const;
export type ExternalIssueSource = (typeof EXTERNAL_ISSUE_SOURCES)[number];
export type IssueSource = "local" | ExternalIssueSource;

export const sourceLabelSchema = z.object({ name: z.string(), color: z.string() });
export type SourceLabel = z.infer<typeof sourceLabelSchema>;

const issueContractBaseSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  title: z.string().min(1),
  body: z.string().nullable(),
  status: z.enum(ISSUE_STATES),
  execution: issueExecutionSchema,
});

export const issueContractSchema = z.discriminatedUnion("source", [
  issueContractBaseSchema.extend({
    source: z.literal("local"),
    source_external_id: z.null(),
    source_identifier: z.null(),
    source_url: z.null(),
    synced_at: z.null(),
    source_assignee_name: z.null(),
    source_priority: z.null(),
    source_labels: z.null(),
    source_state_name: z.null(),
    source_state_color: z.null(),
  }),
  issueContractBaseSchema.extend({
    source: z.enum(EXTERNAL_ISSUE_SOURCES),
    source_external_id: z.string().min(1),
    source_identifier: z.string().min(1),
    source_url: z.url().nullable(),
    synced_at: z.iso.datetime(),
    source_assignee_name: z.string().min(1).nullable(),
    source_priority: z.number().int().nullable(),
    source_labels: z.array(sourceLabelSchema).nullable(),
    source_state_name: z.string().min(1).nullable(),
    source_state_color: z.string().min(1).nullable(),
  }),
]);
export type IssueContract = z.infer<typeof issueContractSchema>;

const issueSourceContractBaseSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  source: z.enum(EXTERNAL_ISSUE_SOURCES),
  external_team_id: z.string(),
  external_team_key: z.string(),
  external_team_name: z.string(),
  last_synced_at: z.iso.datetime().nullable(),
});

export const issueSourceContractSchema = z.union([
  issueSourceContractBaseSchema.extend({
    external_project_id: z.literal(""),
    external_project_name: z.literal(""),
  }),
  issueSourceContractBaseSchema.extend({
    external_project_id: z.string().min(1),
    external_project_name: z.string().min(1),
  }),
]);
export type IssueSourceContract = z.infer<typeof issueSourceContractSchema>;
