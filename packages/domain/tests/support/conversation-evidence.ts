import type { ConversationEvidence } from "#domain/projections/conversations";

export function conversationEvidence(
  overrides: Partial<ConversationEvidence> = {},
): ConversationEvidence {
  return {
    step_run_id: "step-1",
    step_name: "Implement",
    step_status: "running",
    step_created_at: "2026-09-19T10:00:00.000Z",
    step_updated_at: "2026-09-19T10:00:00.000Z",
    latest_session_status: "active",
    run_id: "run-1",
    run_status: "running",
    run_abandoned_at: null,
    issue_id: "issue-1",
    issue_identifier: "OTO-1",
    issue_title: "Ship it",
    project_id: "project-1",
    project_name: "Otomat",
    config: {
      runtime: "claude",
      profile_id: "profile-1",
      profile_name: "Implementer",
      options: { effort: "high" },
      model: { id: "opus", source: "manual" },
      guidance: null,
      skills: [],
      sources: null,
      config_hash: "hash-1",
    },
    reported_model: null,
    last_agent_message: null,
    last_user_message: null,
    pending_interaction: null,
    queued_contributions: 0,
    failed_contribution_at: null,
    ...overrides,
  };
}
