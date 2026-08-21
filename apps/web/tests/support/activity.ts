import type { ActivityContract } from "@otomat/domain";

type RunActivity = Extract<ActivityContract, { kind: "run" }>;

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
    updated_at: "2026-08-20T10:00:00.000Z",
    ...overrides,
  };
}
