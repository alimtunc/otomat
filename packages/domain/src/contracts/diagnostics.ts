import { z } from "zod";

import { EXECUTION_HOST_IDS } from "./execution-host.js";

/** One already-redacted line the daemon kept; `correlation_id` ties it to the call that produced it. */
export const daemonLogEntrySchema = z.object({
  at: z.iso.datetime(),
  correlation_id: z.string().nullable(),
  message: z.string(),
});
export type DaemonLogEntry = z.infer<typeof daemonLogEntrySchema>;

/**
 * `GET /api/diagnostics/logs`: the bounded, redacted excerpt the active host serves for one
 * correlation id. An empty `entries` means the host kept nothing for it — never that it refused.
 */
export const daemonLogExcerptSchema = z.object({
  correlation_id: z.string().nullable(),
  /** True when older correlated entries were dropped to stay inside the requested bound. */
  truncated: z.boolean(),
  entries: z.array(daemonLogEntrySchema),
});
export type DaemonLogExcerpt = z.infer<typeof daemonLogExcerptSchema>;

/** Header the daemon stamps on every `/api` response so a failure can be traced back to its log. */
export const CORRELATION_ID_HEADER = "x-otomat-correlation-id";

/**
 * Where an incident came from. The distinction is what makes the report actionable: a `renderer`
 * exception is not in any daemon log, and a `transport` failure never reached the host at all.
 */
export const ERROR_DIAGNOSTIC_CATEGORIES = ["renderer", "daemon", "transport"] as const;
export type ErrorDiagnosticCategory = (typeof ERROR_DIAGNOSTIC_CATEGORIES)[number];

export const errorDiagnosticRequestSchema = z.object({
  method: z.string(),
  path: z.string(),
  /** Null when no response arrived, which is what separates a transport failure from a daemon one. */
  status: z.number().int().nullable(),
  correlation_id: z.string().nullable(),
});
export type ErrorDiagnosticRequest = z.infer<typeof errorDiagnosticRequestSchema>;

const errorDiagnosticHostSchema = z.object({
  id: z.enum(EXECUTION_HOST_IDS),
  label: z.string(),
  ssh_alias: z.string().nullable(),
});

const errorDiagnosticAppSchema = z.object({
  version: z.string(),
  commit: z.string(),
  channel: z.string(),
});

/**
 * A single incident, already redacted, as it is shown, copied and exported. Every field is either
 * app-owned metadata or text that went through `redactLogText`; prompts, credentials and database
 * contents never reach it.
 */
export const errorDiagnosticSchema = z.object({
  id: z.string(),
  category: z.enum(ERROR_DIAGNOSTIC_CATEGORIES),
  occurred_at: z.iso.datetime(),
  /** Router path the cockpit was on, without search params, which can carry issue or run titles. */
  route: z.string(),
  message: z.string(),
  stack: z.string().nullable(),
  component_stack: z.string().nullable(),
  host: errorDiagnosticHostSchema,
  /** Desktop shell build; null in a plain browser, where there is no shell to report. */
  app: errorDiagnosticAppSchema.nullable(),
  /** Daemon identity from the last health response; null when it was never reached. */
  daemon: z.object({ version: z.string(), build: z.string().nullable() }).nullable(),
  request: errorDiagnosticRequestSchema.nullable(),
  /** Correlated host log; null when the category cannot have one or the host was unreachable. */
  daemon_log: z.array(daemonLogEntrySchema).nullable(),
});
export type ErrorDiagnostic = z.infer<typeof errorDiagnosticSchema>;

/**
 * What the shell will publish for a report the user confirmed. It crosses the renderer→main
 * boundary, so it is a schema and not only a type: main validates before opening anything.
 */
export const problemReportDraftSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
});
export type ProblemReportDraft = z.infer<typeof problemReportDraftSchema>;

/** Outcome of an export the user explicitly asked for; `failed` carries a reason worth showing. */
export type SupportBundleExportResult =
  | { status: "written"; path: string }
  | { status: "canceled" }
  | { status: "failed"; message: string };
