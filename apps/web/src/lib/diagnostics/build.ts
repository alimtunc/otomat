import { redactLogText, type DaemonLogEntry, type ErrorDiagnostic } from "@otomat/domain";
import type { ErrorClassification } from "@web/lib/diagnostics/classify";
import { diagnosticEnvironment } from "@web/lib/diagnostics/environment";

const MAX_TRACE_CHARACTERS = 4_000;
const TRUNCATION_MARK = "\n[TRUNCATED]";

export interface ErrorDiagnosticInput {
  classification: ErrorClassification;
  /** Router path only; search params can carry issue titles and branch names. */
  route: string;
  componentStack: string | null;
  daemon: ErrorDiagnostic["daemon"];
  daemonLog: DaemonLogEntry[] | null;
  occurredAt: Date;
}

function sanitizeTrace(value: string | null): string | null {
  if (value === null) return null;
  const safe = redactLogText(value).trimEnd();
  if (safe === "") return null;
  return safe.length > MAX_TRACE_CHARACTERS
    ? `${safe.slice(0, MAX_TRACE_CHARACTERS)}${TRUNCATION_MARK}`
    : safe;
}

/** Redaction happens once, here, so the panel and the exported bundle can never disagree about what is safe. */
export function buildErrorDiagnostic(input: ErrorDiagnosticInput): ErrorDiagnostic {
  const classification = input.classification;
  const environment = diagnosticEnvironment();
  return {
    id: `err_${input.occurredAt.getTime().toString(36)}`,
    category: classification.category,
    occurred_at: input.occurredAt.toISOString(),
    route: input.route,
    message: redactLogText(classification.message).trim(),
    stack: sanitizeTrace(classification.stack),
    component_stack: sanitizeTrace(input.componentStack),
    host: environment.host,
    app: environment.app,
    daemon: input.daemon,
    request: classification.request,
    daemon_log: input.daemonLog,
  };
}
