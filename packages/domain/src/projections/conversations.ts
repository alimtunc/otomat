import type {
  ConversationEntry,
  ConversationParticipant,
  ConversationThreadEntry,
} from "../contracts/conversations.js";
import type { ResolvedAgentConfig } from "../contracts/entities/agents.js";
import type { InboxMark } from "../contracts/inbox.js";
import type { AgentSessionState } from "../state-machines/agent-session.js";
import type { RunInteractionKind } from "../state-machines/run-interaction.js";
import type { RunState } from "../state-machines/run.js";
import { liveStepStatus, type StepRunState } from "../state-machines/step-run.js";
import type { IssueExecutionEvidence } from "./evidence.js";
import { projectIssueExecution } from "./issue-execution.js";
import { isCycleClosed, projectIssueWorkspace } from "./issue-workspace.js";
import { projectOpenCycleExecution, type OpenCycleExecution } from "./primary-state.js";

export interface ConversationMessageEvidence {
  text: string;
  at: string;
}

/** One step's thread with the facts a conversation is built from; every `null` is an absence the daemon read, never an unknown. */
export interface ConversationEvidence {
  step_run_id: string;
  step_name: string;
  step_status: StepRunState;
  step_created_at: string;
  step_updated_at: string;
  latest_session_status: AgentSessionState | null;
  run_id: string;
  run_status: RunState;
  run_abandoned_at: string | null;
  issue_id: string;
  issue_identifier: string | null;
  issue_title: string;
  project_id: string;
  project_name: string;
  config: ResolvedAgentConfig | null;
  reported_model: string | null;
  /** The newest answer that is not reasoning; a turn's tool calls and logs never count. */
  last_agent_message: ConversationMessageEvidence | null;
  last_user_message: ConversationMessageEvidence | null;
  pending_interaction: { kind: RunInteractionKind; prompt: string; requested_at: string } | null;
  queued_contributions: number;
  failed_contribution_at: string | null;
}

/** Step states worth reading about: a question, an outcome, or a stop only the operator can lift. */
const ACTIONABLE_STEP_STATES: ReadonlySet<StepRunState> = new Set([
  "awaiting_permission",
  "awaiting_human",
  "waiting_for_provider",
  "succeeded",
  "failed",
  "stale",
]);

function participantOf(row: ConversationEvidence): ConversationParticipant | null {
  if (row.config === null) return null;
  return {
    runtime: row.config.runtime,
    profile_name: row.config.profile_name,
    model: row.reported_model ?? row.config.model?.id ?? null,
    effort: row.config.options.effort ?? row.config.options.reasoning_effort ?? null,
  };
}

function lastOf(row: ConversationEvidence): ConversationEntry["last"] {
  const candidates: NonNullable<ConversationEntry["last"]>[] = [];
  if (row.pending_interaction !== null) {
    candidates.push({
      kind: "interaction",
      text: row.pending_interaction.prompt,
      at: row.pending_interaction.requested_at,
    });
  }
  if (row.last_agent_message !== null)
    candidates.push({ kind: "agent", ...row.last_agent_message });
  if (row.last_user_message !== null) candidates.push({ kind: "user", ...row.last_user_message });
  return candidates.toSorted((a, b) => b.at.localeCompare(a.at))[0] ?? null;
}

/** The operator's own message never moves the thread: they were in it when they wrote it. */
function updatedAtOf(row: ConversationEvidence): string {
  const instants = [row.step_created_at];
  if (row.last_agent_message !== null) instants.push(row.last_agent_message.at);
  if (ACTIONABLE_STEP_STATES.has(row.step_status)) instants.push(row.step_updated_at);
  if (row.pending_interaction !== null) instants.push(row.pending_interaction.requested_at);
  if (row.failed_contribution_at !== null) instants.push(row.failed_contribution_at);
  return instants.toSorted().at(-1) ?? row.step_created_at;
}

/** A cancel and an abandon are the operator's own act, so their threads are never news; a mark made on older evidence is stale. */
function readingOf(
  row: ConversationEvidence,
  updatedAt: string,
  mark: InboxMark | undefined,
): Pick<ConversationEntry, "read" | "archived"> {
  const current = mark !== undefined && mark.evidence_updated_at >= updatedAt;
  const silenced = row.step_status === "canceled" || row.run_abandoned_at !== null;
  return { read: silenced || (current && mark.read), archived: current && mark.archived };
}

/** A live run is followed before `preparing` creates the worktree that would open its cycle. */
export function projectFollowedCycle(
  rows: readonly IssueExecutionEvidence[],
): OpenCycleExecution | null {
  const execution = projectIssueExecution(rows);
  const open = projectOpenCycleExecution({ execution, workspace: projectIssueWorkspace(rows) });
  if (open !== null || execution.state !== "running") return open;
  const run = rows.find((row) => row.run_id === execution.run_id);
  return run !== undefined && !isCycleClosed(run) ? execution : null;
}

export type ConversationCycles = ReadonlyMap<string, OpenCycleExecution>;

export function projectConversations(
  evidence: readonly ConversationEvidence[],
  marks: readonly InboxMark[],
  cycles: ConversationCycles,
): ConversationEntry[] {
  const markById = new Map(marks.map((mark) => [mark.entry_id, mark]));
  return evidence
    .map((row): ConversationEntry => {
      const id = `conversation:${row.step_run_id}`;
      const updated_at = updatedAtOf(row);
      return {
        id,
        project: { id: row.project_id, name: row.project_name },
        issue: {
          id: row.issue_id,
          identifier: row.issue_identifier,
          title: row.issue_title,
          cycle: cycles.get(row.issue_id)?.state ?? null,
        },
        run_id: row.run_id,
        run_status: row.run_status,
        step_run_id: row.step_run_id,
        step_name: row.step_name,
        step_status: liveStepStatus(row.step_status, row.latest_session_status),
        participant: participantOf(row),
        last: lastOf(row),
        pending_interaction:
          row.pending_interaction === null
            ? null
            : { kind: row.pending_interaction.kind, prompt: row.pending_interaction.prompt },
        queued_contributions: row.queued_contributions,
        updated_at,
        ...readingOf(row, updated_at, markById.get(id)),
      };
    })
    .toSorted(
      (a, b) =>
        b.updated_at.localeCompare(a.updated_at) || a.step_run_id.localeCompare(b.step_run_id),
    );
}

export function countUnreadConversations(entries: readonly ConversationThreadEntry[]): number {
  return entries.filter((entry) => !entry.read && !entry.archived).length;
}
