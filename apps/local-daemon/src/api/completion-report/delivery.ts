import { getPullRequestForRun, listLinearWritesForIssue, type Db } from "@otomat/db";
import {
  reportLinearSchema,
  reportPullRequestSchema,
  type RunCompletionReport,
} from "@otomat/domain";

interface DeliveryProjectionInput {
  db: Db;
  errors: RunCompletionReport["errors"];
  issueId: string;
  runId: string;
}

function projectPullRequest({
  db,
  errors,
  runId,
}: DeliveryProjectionInput): RunCompletionReport["pull_request"] {
  const row = getPullRequestForRun(db, runId);
  const parsed = reportPullRequestSchema.safeParse(
    row
      ? {
          state: "reported",
          number: row.number,
          url: row.url,
          status: row.status,
          publication_status: row.publication_status,
          error: row.error_message,
          evidence: [{ source: "pull_request", url: row.url }],
        }
      : {
          state: "not_reported",
          number: null,
          url: null,
          status: null,
          publication_status: null,
          error: null,
          evidence: [{ source: "pull_request", url: null }],
        },
  );
  if (parsed.success) return parsed.data;
  errors.push({
    code: "pull_request_unavailable",
    message: "Persisted pull request evidence could not be read.",
    evidence: [{ source: "pull_request", url: null }],
  });
  return {
    state: "unavailable",
    number: null,
    url: null,
    status: null,
    publication_status: null,
    error: null,
    evidence: [{ source: "pull_request", url: null }],
  };
}

function projectLinear({
  db,
  errors,
  issueId,
  runId,
}: DeliveryProjectionInput): RunCompletionReport["linear"] {
  const writes = listLinearWritesForIssue(db, issueId).filter((write) => write.run_id === runId);
  const parsed = reportLinearSchema.safeParse({
    state: writes.length === 0 ? "not_reported" : "reported",
    writes: writes.map((write) => ({
      id: write.id,
      kind: write.kind,
      status: write.status,
      detail: write.detail,
      error: write.error_message,
      evidence: [{ source: "linear", write_id: write.id }],
    })),
  });
  if (parsed.success) return parsed.data;
  errors.push({
    code: "linear_unavailable",
    message: "Persisted Linear evidence could not be read.",
    evidence: [],
  });
  return { state: "unavailable", writes: [] };
}

export function projectDelivery(
  input: DeliveryProjectionInput,
): Pick<RunCompletionReport, "linear" | "pull_request"> {
  return {
    pull_request: projectPullRequest(input),
    linear: projectLinear(input),
  };
}
