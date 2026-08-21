import type { ActivityContract } from "@otomat/domain";

const UPDATED_AT = "2026-08-20T10:00:00.000Z";

type RunActivity = Extract<ActivityContract, { kind: "run" }>;
type PublicationActivity = Extract<ActivityContract, { kind: "pull_request_publication" }>;

export function runActivity(overrides: Partial<RunActivity> = {}): RunActivity {
  return {
    kind: "run",
    id: `run:${overrides.run_id ?? "run-1"}`,
    bucket: "running",
    status: "running",
    project: { id: "p1", name: "Otomat" },
    issue: { id: "i1", identifier: "ABC-1", title: "Ship it" },
    run_id: "run-1",
    phase: "Implement",
    updated_at: UPDATED_AT,
    ...overrides,
  };
}

export function publicationActivity(
  overrides: Partial<PublicationActivity> = {},
): PublicationActivity {
  return {
    kind: "pull_request_publication",
    id: "publication:pr-1",
    bucket: "running",
    operation: {
      id: "pr-1",
      kind: "pull_request_publication",
      state: "running",
      phases: [{ key: "push", label: "Pushing the branch", state: "active" }],
      error: null,
      retryable: false,
      updated_at: UPDATED_AT,
    },
    project: { id: "p1", name: "Otomat" },
    issue: { id: "i1", identifier: "ABC-1", title: "Ship it" },
    run_id: "run-1",
    phase: "Pushing the branch",
    updated_at: UPDATED_AT,
    ...overrides,
  };
}
