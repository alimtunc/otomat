import type { EventEnvelope, RunContributionContract } from "@otomat/domain";

/** Ledger families a reader follows on their own; everything else folds into a collapsed group. */
const MILESTONE_TYPES: ReadonlySet<EventEnvelope["type"]> = new Set([
  "run.lifecycle",
  "git.diff_updated",
  "pr.created",
  "pr.updated",
]);

export interface ActivityCounts {
  tools: number;
  permissions: number;
  thinking: number;
  logs: number;
  other: number;
}

export type ConversationItem =
  | { kind: "step"; key: string; name: string }
  | { kind: "message"; key: string; contribution: RunContributionContract }
  | { kind: "agent"; key: string; event: EventEnvelope; text: string }
  | { kind: "milestone"; key: string; event: EventEnvelope }
  | { kind: "activity"; key: string; events: EventEnvelope[]; counts: ActivityCounts };

export interface ConversationStep {
  id: string;
  name: string;
}

/** A failed message is retriable only while nothing was ever handed to the provider. */
export function isRetriable(contribution: RunContributionContract): boolean {
  return contribution.status === "failed" && contribution.delivered_at === null;
}

export function queuedCount(contributions: readonly RunContributionContract[]): number {
  return contributions.reduce((count, item) => count + (item.status === "queued" ? 1 : 0), 0);
}

/** The assistant's own words. Reasoning is not the answer the user is waiting for, so it stays grouped. */
function agentText(event: EventEnvelope): string | null {
  if (event.type !== "runtime.message" || event.payload["thinking"] === true) return null;
  const text = event.payload["text"];
  return typeof text === "string" && text.trim().length > 0 ? text : null;
}

function contributionId(event: EventEnvelope): string | null {
  const id = event.payload["contribution_id"];
  return typeof id === "string" ? id : null;
}

function countActivity(events: readonly EventEnvelope[]): ActivityCounts {
  const counts: ActivityCounts = { tools: 0, permissions: 0, thinking: 0, logs: 0, other: 0 };
  for (const event of events) {
    if (event.type === "runtime.tool_call") counts.tools += 1;
    else if (event.type.startsWith("runtime.permission")) counts.permissions += 1;
    else if (event.type === "runtime.message") counts.thinking += 1;
    else if (event.type === "runtime.log") counts.logs += 1;
    else counts.other += 1;
  }
  return counts;
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export function describeActivity(counts: ActivityCounts, total: number): string {
  const parts: string[] = [];
  if (counts.tools > 0) parts.push(plural(counts.tools, "tool"));
  if (counts.permissions > 0) parts.push(plural(counts.permissions, "permission"));
  if (counts.thinking > 0) parts.push(`${counts.thinking} reasoning`);
  if (counts.logs > 0) parts.push(plural(counts.logs, "log"));
  if (counts.other > 0) parts.push(`${counts.other} other`);
  const detail = parts.length > 0 ? ` · ${parts.join(" · ")}` : "";
  return `${plural(total, "step")}${detail}`;
}

/**
 * One run's thread, reduced to what a reader follows: their own messages, the
 * agent's replies, and the milestones that carry proof. Tool calls, logs,
 * reasoning and permission round-trips fold into one collapsed group per run of
 * them, so the conversation stays readable without hiding anything.
 *
 * Ordering comes from the ledger — each message is anchored at the
 * `run.contribution` event written when the user sent it — while delivery state
 * comes from the contributions read model. A message the stream has not carried
 * yet closes the thread in send order instead of disappearing.
 */
export function buildConversation(
  events: readonly EventEnvelope[],
  contributions: readonly RunContributionContract[],
  steps: readonly ConversationStep[] = [],
): ConversationItem[] {
  const byId = new Map(contributions.map((contribution) => [contribution.id, contribution]));
  const stepNames = steps.length > 1 ? new Map(steps.map((step) => [step.id, step.name])) : null;
  const anchored = new Set<string>();
  const items: ConversationItem[] = [];
  let pending: EventEnvelope[] = [];
  let currentStepId: string | null = null;

  function flush(): void {
    if (pending.length === 0) return;
    items.push({
      kind: "activity",
      key: `activity-${pending[0]?.seq}`,
      events: pending,
      counts: countActivity(pending),
    });
    pending = [];
  }

  /** Run-level events (no step) stay under the section already open, as the flat timeline did. */
  function openStepSection(event: EventEnvelope): void {
    if (stepNames === null) return;
    const stepId = event.step_run_id;
    if (stepId === null || stepId === currentStepId) return;
    flush();
    currentStepId = stepId;
    items.push({
      kind: "step",
      key: `step-${stepId}-${event.seq}`,
      name: stepNames.get(stepId) ?? "Run",
    });
  }

  for (const event of events) {
    openStepSection(event);
    if (event.type === "run.contribution") {
      const id = contributionId(event);
      const contribution = id === null ? undefined : byId.get(id);
      if (id === null || anchored.has(id) || contribution === undefined) continue;
      flush();
      anchored.add(id);
      items.push({ kind: "message", key: `message-${id}`, contribution });
      continue;
    }
    const text = agentText(event);
    if (text !== null) {
      flush();
      items.push({ kind: "agent", key: `agent-${event.seq}`, event, text });
      continue;
    }
    if (MILESTONE_TYPES.has(event.type)) {
      flush();
      items.push({ kind: "milestone", key: `milestone-${event.seq}`, event });
      continue;
    }
    pending.push(event);
  }
  flush();

  for (const contribution of contributions) {
    if (anchored.has(contribution.id)) continue;
    items.push({ kind: "message", key: `message-${contribution.id}`, contribution });
  }
  return items;
}
