import type { EventEnvelope } from "@otomat/domain";

function lifecycleSummary(event: EventEnvelope): string | null {
  const runStatus = event.payload["run_status"];
  if (typeof runStatus === "string") return `run ${runStatus}`;
  const reopened = event.payload["step_name"];
  if (typeof reopened === "string") return `run reopened at ${reopened}`;
  const finalStatus = event.payload["final_status"];
  return typeof finalStatus === "string" ? `turn ${finalStatus}` : null;
}

function contributionSummary(event: EventEnvelope): string | null {
  const status = event.payload["status"];
  const body = event.payload["body"];
  if (typeof status !== "string" || typeof body !== "string") return null;
  return `your message (${status}) · ${body}`;
}

function commentSummary(event: EventEnvelope): string | null {
  const filePath = event.payload["file_path"];
  const line = event.payload["line"];
  if (typeof filePath !== "string") return null;
  return typeof line === "number" ? `comment · ${filePath}:${line}` : `comment · ${filePath}`;
}

function typedSummary(event: EventEnvelope): string | null {
  switch (event.type) {
    case "run.lifecycle":
      return lifecycleSummary(event);
    case "run.contribution":
      return contributionSummary(event);
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
