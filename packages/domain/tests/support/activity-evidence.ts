import type { ActivityEvidence } from "#domain/projections/activity";

export function activityEvidence(overrides: Partial<ActivityEvidence> = {}): ActivityEvidence {
  return {
    run_id: "run-1",
    run_status: "running",
    run_started_at: "2026-09-15T10:00:00.000Z",
    run_updated_at: "2026-09-15T10:00:00.000Z",
    run_abandoned_at: null,
    run_superseded: false,
    current_step: "Implement",
    halted_step: null,
    issue_id: "issue-1",
    issue_identifier: "OTO-1",
    issue_title: "Ship it",
    issue_status: "running",
    project_id: "project-1",
    project_name: "Otomat",
    publication: null,
    ...overrides,
  };
}
