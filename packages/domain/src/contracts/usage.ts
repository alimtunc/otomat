import { z } from "zod";

import { USAGE_AVAILABILITIES } from "../projections/usage.js";
import { RUN_STATES, STEP_RUN_STATES } from "./entity-states.js";

/** Kept with its provenance: nothing here is estimated, and an absent field is never rendered as a zero. */
export const reportedUsageSchema = z
  .object({
    availability: z.enum(USAGE_AVAILABILITIES),
    input_tokens: z.number().int().nonnegative().nullable(),
    output_tokens: z.number().int().nonnegative().nullable(),
    cost_usd: z.number().nonnegative().nullable(),
    turns: z.number().int().nonnegative(),
  })
  .strict();
export type ReportedUsageContract = z.infer<typeof reportedUsageSchema>;

export const runUsageStepSchema = z
  .object({
    step_run_id: z.string(),
    name: z.string().min(1),
    status: z.enum(STEP_RUN_STATES),
    usage: reportedUsageSchema,
  })
  .strict();
export type RunUsageStep = z.infer<typeof runUsageStepSchema>;

/** A run's usage read from the whole ledger — never summed from the page the cockpit happens to have loaded. */
export const runUsageResponseSchema = z
  .object({
    run_id: z.string(),
    total: reportedUsageSchema,
    steps: z.array(runUsageStepSchema),
  })
  .strict();
export type RunUsageResponse = z.infer<typeof runUsageResponseSchema>;

/** Rolling windows, so a bucket edge never disagrees with the window edge the way calendar months would. */
export const USAGE_PERIODS = ["7d", "30d", "90d", "all"] as const;
export const usagePeriodSchema = z.enum(USAGE_PERIODS);
export type UsagePeriod = (typeof USAGE_PERIODS)[number];

const UTC_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function isUsageDay(value: string): boolean {
  return UTC_DAY.test(value);
}

/** A sum with the number of turns that produced it, so a partial total is derived rather than asserted. */
export const usageMetricSchema = z
  .object({
    value: z.number().nonnegative().nullable(),
    reported_turns: z.number().int().nonnegative(),
  })
  .strict();
export type UsageMetric = z.infer<typeof usageMetricSchema>;

export const usageFiguresSchema = z
  .object({
    turns: z.number().int().nonnegative(),
    /** Turns whose payload carried no readable usage object; they report nothing and are never a zero. */
    unreadable_turns: z.number().int().nonnegative(),
    input_tokens: usageMetricSchema,
    output_tokens: usageMetricSchema,
    cost_usd: usageMetricSchema,
  })
  .strict();
export type UsageFigures = z.infer<typeof usageFiguresSchema>;

export const usageEmitterSchema = z
  .object({ runtime: z.string().nullable(), model: z.string().nullable() })
  .strict();
export type UsageEmitter = z.infer<typeof usageEmitterSchema>;

export const usageDurationSchema = z
  .object({
    total_ms: z.number().int().nonnegative().nullable(),
    measured_runs: z.number().int().nonnegative(),
    /** Runs still open or missing a boundary stamp: left out of the sum instead of counted as instant. */
    unmeasured_runs: z.number().int().nonnegative(),
  })
  .strict();
export type UsageDuration = z.infer<typeof usageDurationSchema>;

export const usageTotalsSchema = z
  .object({
    figures: usageFiguresSchema,
    runs: z.number().int().nonnegative(),
    steps: z.number().int().nonnegative(),
    duration: usageDurationSchema,
  })
  .strict();
export type UsageTotals = z.infer<typeof usageTotalsSchema>;

const usageBucketSchema = z
  .object({ figures: usageFiguresSchema, runs: z.number().int().nonnegative() })
  .strict();

export const usageDayBucketSchema = usageBucketSchema.extend({ day: z.string().regex(UTC_DAY) });
export type UsageDayBucket = z.infer<typeof usageDayBucketSchema>;

export const usageProjectBucketSchema = usageBucketSchema.extend({
  project_id: z.string(),
  project_name: z.string(),
});
export type UsageProjectBucket = z.infer<typeof usageProjectBucketSchema>;

export const usageEmitterBucketSchema = usageBucketSchema.extend({ emitter: usageEmitterSchema });
export type UsageEmitterBucket = z.infer<typeof usageEmitterBucketSchema>;

export const usageRunRowSchema = z
  .object({
    run_id: z.string(),
    status: z.enum(RUN_STATES),
    project_id: z.string(),
    project_name: z.string(),
    issue_id: z.string(),
    issue_identifier: z.string().nullable(),
    issue_title: z.string(),
    emitters: z.array(usageEmitterSchema),
    last_activity_at: z.iso.datetime(),
    duration_ms: z.number().int().nonnegative().nullable(),
    figures: usageFiguresSchema,
  })
  .strict();
export type UsageRunRow = z.infer<typeof usageRunRowSchema>;

export const usageIssueOptionSchema = z
  .object({ id: z.string(), identifier: z.string().nullable(), title: z.string() })
  .strict();
export type UsageIssueOption = z.infer<typeof usageIssueOptionSchema>;

export const usageFacetOptionsSchema = z
  .object({
    projects: z.array(z.object({ id: z.string(), name: z.string() }).strict()),
    emitters: z.array(usageEmitterSchema),
    issues: z.array(usageIssueOptionSchema),
  })
  .strict();
export type UsageFacetOptions = z.infer<typeof usageFacetOptionsSchema>;

export const usageFiltersSchema = z
  .object({
    period: usagePeriodSchema,
    day: z.string().regex(UTC_DAY).nullable(),
    projects: z.array(z.string()),
    runtimes: z.array(z.string()),
    models: z.array(z.string()),
    issues: z.array(z.string()),
  })
  .strict();
export type UsageFilters = z.infer<typeof usageFiltersSchema>;

export const NO_USAGE_FILTERS: UsageFilters = {
  period: "30d",
  day: null,
  projects: [],
  runtimes: [],
  models: [],
  issues: [],
};

export const usageRangeSchema = z
  .object({ from: z.iso.datetime().nullable(), to: z.iso.datetime() })
  .strict();
export type UsageRange = z.infer<typeof usageRangeSchema>;

export const usageDashboardSchema = z
  .object({
    range: usageRangeSchema,
    totals: usageTotalsSchema,
    daily: z.array(usageDayBucketSchema),
    projects: z.array(usageProjectBucketSchema),
    emitters: z.array(usageEmitterBucketSchema),
    runs: z.array(usageRunRowSchema),
    options: usageFacetOptionsSchema,
  })
  .strict();
export type UsageDashboard = z.infer<typeof usageDashboardSchema>;
