import { z } from "zod";

import { refinePlanGraph } from "../plan/graph.js";
import { RUN_PLAN_MAX_STEPS } from "../plan/limits.js";
import {
  planDependenciesSchema,
  planNodeIdSchema,
  planNodeNameSchema,
  planNodeTemplateShape,
} from "../plan/node-input.js";
import { AGENT_PROFILE_ERRORS } from "./agent-profile.js";

export const WORKFLOW_PRESET_NAME_MAX_LENGTH = 80;

/** Why a preset write was refused; safe to show verbatim in the UI. */
export const WORKFLOW_PRESET_ERRORS = [
  "preset_not_found",
  "preset_name_taken",
  "preset_project_unknown",
] as const;
export type WorkflowPresetError = (typeof WORKFLOW_PRESET_ERRORS)[number];

export const workflowPresetErrorSchema = z.object({
  error: z.enum(WORKFLOW_PRESET_ERRORS),
  message: z.string(),
});

const workflowPresetCompetitorSchema = z
  .object({ id: planNodeIdSchema, name: planNodeNameSchema, ...planNodeTemplateShape })
  .strict();

/** One agent turn inside a preset: a step, or one candidate of a compete group. */
export type WorkflowPresetExecutable = z.infer<typeof workflowPresetCompetitorSchema>;

const workflowPresetStepSchema = z
  .object({
    id: planNodeIdSchema,
    name: planNodeNameSchema,
    ...planNodeTemplateShape,
    depends_on: planDependenciesSchema,
  })
  .strict();

const workflowPresetCompeteGroupSchema = z
  .object({
    id: planNodeIdSchema,
    name: planNodeNameSchema,
    depends_on: planDependenciesSchema,
    compete: z.array(workflowPresetCompetitorSchema).min(2).max(RUN_PLAN_MAX_STEPS),
  })
  .strict();

const workflowPresetNodeSchema = z.union([
  workflowPresetStepSchema,
  workflowPresetCompeteGroupSchema,
]);

/**
 * A preset's stored structure: the same graph a launch validates, minus the context
 * a launch attaches. It never holds an issue, a repository file, run data or a secret.
 * An empty plan is savable — a preset is composed over time — and refused at launch.
 */
export const workflowPresetPlanSchema = z
  .object({
    version: z.literal(1),
    steps: z.array(workflowPresetNodeSchema).max(RUN_PLAN_MAX_STEPS),
  })
  .strict()
  .superRefine((plan, ctx) => refinePlanGraph(plan.steps, ctx));
export type WorkflowPresetPlan = z.infer<typeof workflowPresetPlanSchema>;

export const WORKFLOW_PRESET_SCOPES = ["global", "project"] as const;
export const workflowPresetScopeSchema = z.enum(WORKFLOW_PRESET_SCOPES);
export type WorkflowPresetScope = (typeof WORKFLOW_PRESET_SCOPES)[number];

const globalScopeSchema = z.object({ scope: z.literal("global") });
const projectScopeSchema = z.object({
  scope: z.literal("project"),
  project_id: z.string().min(1),
});

const presetIdentityShape = {
  name: z.string().trim().min(1).max(WORKFLOW_PRESET_NAME_MAX_LENGTH),
  plan: workflowPresetPlanSchema,
};

/** A project preset names its project and a global one must not, so scope and owner cannot disagree. */
export const saveWorkflowPresetRequestSchema = z.discriminatedUnion("scope", [
  globalScopeSchema.extend(presetIdentityShape).strict(),
  projectScopeSchema.extend(presetIdentityShape).strict(),
]);
export type SaveWorkflowPresetRequest = z.infer<typeof saveWorkflowPresetRequestSchema>;

/** Copying a global preset into a project is how it gets adapted there; the source is never touched. */
export const duplicateWorkflowPresetRequestSchema = z.discriminatedUnion("scope", [
  globalScopeSchema.strict(),
  projectScopeSchema.strict(),
]);
export type DuplicateWorkflowPresetRequest = z.infer<typeof duplicateWorkflowPresetRequestSchema>;

/** One node whose agent cannot be resolved on this host, with the refusal a launch would return. */
const workflowPresetIssueSchema = z.object({
  node_id: z.string(),
  node_name: z.string(),
  error: z.enum(AGENT_PROFILE_ERRORS),
  message: z.string(),
});
export type WorkflowPresetIssue = z.infer<typeof workflowPresetIssueSchema>;

export const workflowPresetCompatibilitySchema = z.object({
  /** False while the preset holds no step, or a node names a profile, skill or runtime this host cannot resolve. */
  launchable: z.boolean(),
  issues: z.array(workflowPresetIssueSchema),
});
export type WorkflowPresetCompatibility = z.infer<typeof workflowPresetCompatibilitySchema>;

/** A saved workflow structure. Applying it fills the launcher; it is never itself a run. */
export const workflowPresetContractSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  scope: workflowPresetScopeSchema,
  /** The project a `project` preset belongs to; null for a global one. */
  project_id: z.string().nullable(),
  plan: workflowPresetPlanSchema,
  compatibility: workflowPresetCompatibilitySchema,
});
export type WorkflowPresetContract = z.infer<typeof workflowPresetContractSchema>;
