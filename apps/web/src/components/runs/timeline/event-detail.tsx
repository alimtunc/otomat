import { RUN_STATES, type EventEnvelope, type RunState } from "@otomat/domain";
import { RunStatusChip } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { formatCostUsd, formatTokenCount } from "@web/lib/run-usage";
import type { ReactNode } from "react";

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isRunState(value: unknown): value is RunState {
  return typeof value === "string" && (RUN_STATES as readonly string[]).includes(value);
}

function JsonDisclosure({ label, value }: { label: string; value: unknown }) {
  return (
    <details className="mt-1 max-w-full">
      <summary className="cursor-pointer select-none text-xs text-text-tertiary">{label}</summary>
      <pre className="mt-1 overflow-x-auto rounded-md border border-border-subtle bg-surface-1 px-2.5 py-2 font-mono text-xs leading-relaxed text-text-secondary">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

function ToolCallDetail({ event }: { event: EventEnvelope }) {
  const args = event.payload["args"];
  const result = event.payload["result"];
  const isError = event.payload["is_error"] === true;
  return (
    <div className="flex flex-col">
      {isError ? <span className="mt-0.5 text-xs text-danger">tool reported an error</span> : null}
      {args !== undefined && args !== null ? <JsonDisclosure label="args" value={args} /> : null}
      {result !== undefined && result !== null ? (
        <JsonDisclosure label="result" value={result} />
      ) : null}
    </div>
  );
}

function PermissionRequestDetail({ event }: { event: EventEnvelope }) {
  const action = asString(event.payload["action"]);
  const path = asString(event.payload["path"]);
  return (
    <div className="mt-1 flex max-w-120 flex-col gap-1 rounded-md border border-warning bg-warning-bg px-3 py-2 text-xs">
      <span className="font-medium text-warning">
        Permission requested
        {action ? (
          <>
            {" "}
            · <span className="font-mono">{action}</span>
          </>
        ) : null}
      </span>
      {path ? <span className="font-mono text-text-secondary">{path}</span> : null}
      <span className="text-text-tertiary">
        Read-only — respond from the agent, permission decisions are not available here yet.
      </span>
    </div>
  );
}

function UsageDetail({ event }: { event: EventEnvelope }) {
  const usage = event.payload["usage"];
  if (typeof usage !== "object" || usage === null) return null;
  const record = usage as Record<string, unknown>;
  const model = asString(record["model"]);
  const inputTokens = asNumber(record["input_tokens"]);
  const outputTokens = asNumber(record["output_tokens"]);
  const costUsd = asNumber(record["cost_usd"]);
  const parts: string[] = [];
  if (inputTokens !== null) parts.push(`in ${formatTokenCount(inputTokens)}`);
  if (outputTokens !== null) parts.push(`out ${formatTokenCount(outputTokens)}`);
  if (costUsd !== null) parts.push(formatCostUsd(costUsd));
  if (model !== null) parts.push(model);
  if (parts.length === 0) return null;
  return (
    <span className="mt-1 inline-flex items-center rounded-full border border-border-subtle bg-surface-1 px-2.5 py-0.5 font-mono text-xs text-text-secondary">
      {parts.join(" · ")}
    </span>
  );
}

function DiffUpdatedDetail({ event }: { event: EventEnvelope }) {
  const additions = asNumber(event.payload["additions"]);
  const deletions = asNumber(event.payload["deletions"]);
  const fileCount = asNumber(event.payload["file_count"]);
  return (
    <span className="mt-1 inline-flex items-center gap-2 font-mono text-xs">
      {additions !== null ? <span className="text-success">+{additions}</span> : null}
      {deletions !== null ? <span className="text-danger">−{deletions}</span> : null}
      {fileCount !== null ? (
        <span className="text-text-tertiary">
          {fileCount} {fileCount === 1 ? "file" : "files"}
        </span>
      ) : null}
      <Link
        to="/runs/$runId/diff"
        params={{ runId: event.run_id }}
        className="font-sans text-iris-text hover:underline"
      >
        View diff →
      </Link>
    </span>
  );
}

function LifecycleDetail({ event }: { event: EventEnvelope }) {
  const finalStatus = event.payload["final_status"];
  if (!isRunState(finalStatus)) return null;
  return (
    <span className="mt-1 inline-flex">
      <RunStatusChip status={finalStatus} />
    </span>
  );
}

function PullRequestDetail({ event }: { event: EventEnvelope }) {
  const url = asString(event.payload["url"]);
  const number = asNumber(event.payload["number"]);
  const status = asString(event.payload["status"]);
  return (
    <span className="mt-1 inline-flex items-center gap-2 text-xs">
      {status ? <span className="text-text-secondary">{status}</span> : null}
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="text-iris-text hover:underline">
          {number !== null ? `#${number}` : "Open on GitHub"} ↗
        </a>
      ) : null}
    </span>
  );
}

/** Per-type readable detail rendered under an event's summary row; null when the payload has nothing beyond the summary. */
export function eventDetail(event: EventEnvelope): ReactNode {
  switch (event.type) {
    case "runtime.tool_call":
      return <ToolCallDetail event={event} />;
    case "runtime.permission_request":
      return <PermissionRequestDetail event={event} />;
    case "runtime.usage":
      return <UsageDetail event={event} />;
    case "git.diff_updated":
      return <DiffUpdatedDetail event={event} />;
    case "run.lifecycle":
      return <LifecycleDetail event={event} />;
    case "pr.created":
    case "pr.updated":
      return <PullRequestDetail event={event} />;
    default:
      return null;
  }
}
