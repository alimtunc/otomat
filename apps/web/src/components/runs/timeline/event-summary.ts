import type { EventEnvelope } from "@otomat/domain";

function lifecycleSummary(event: EventEnvelope): string | null {
  const finalStatus = event.payload["final_status"];
  return typeof finalStatus === "string" ? `run ${finalStatus}` : null;
}

function commentSummary(event: EventEnvelope): string | null {
  const filePath = event.payload["file_path"];
  const line = event.payload["line"];
  if (typeof filePath !== "string") return null;
  return typeof line === "number" ? `comment · ${filePath}:${line}` : `comment · ${filePath}`;
}

/** Type-specific one-liner for control-plane events whose payloads carry no `text`/`tool` field. */
function typedSummary(event: EventEnvelope): string | null {
  switch (event.type) {
    case "run.lifecycle":
      return lifecycleSummary(event);
    case "git.diff_updated":
      return "canonical git diff updated";
    case "runtime.usage":
      return "usage reported by the runtime";
    case "review.comment_created":
      return commentSummary(event);
    case "review.comment_resolved":
      return "review comment resolved";
    case "pr.created":
      return "pull request created";
    case "pr.updated":
      return "pull request updated";
    default:
      return null;
  }
}

/** One-line human summary: the first present payload field by priority (text, tool, action, decision, provider session id), else the raw event type. */
export function eventSummary(event: EventEnvelope): string {
  const typed = typedSummary(event);
  if (typed !== null) return typed;
  const payload = event.payload;
  if (typeof payload.text === "string") return payload.text;
  if (typeof payload.tool === "string") return `tool · ${payload.tool}`;
  if (typeof payload.action === "string") return `permission · ${payload.action}`;
  if (typeof payload.decision === "string") return `decision · ${payload.decision}`;
  if (typeof payload.provider_session_id === "string") {
    return `session · ${payload.provider_session_id}`;
  }
  return event.type;
}
