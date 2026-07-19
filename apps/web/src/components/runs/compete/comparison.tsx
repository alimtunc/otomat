import type {
  CompeteGroupContract,
  EventEnvelope,
  RunDetail,
  StepRunContract,
} from "@otomat/domain";
import {
  Badge,
  Button,
  cn,
  CompeteGroupStatusChip,
  Icon,
  Skeleton,
  StepStatusChip,
} from "@otomat/ui";
import { useSelectCompeteWinner } from "@web/api/runs/mutations";
import { useCompeteCandidateDiff } from "@web/api/runs/queries";
import {
  CandidateProviderUsage,
  CandidateRuntimeActivity,
} from "@web/components/runs/compete/candidate-runtime-evidence";
import { CandidateTestEvidence } from "@web/components/runs/compete/candidate-test-evidence";
import { collectTestEvidence } from "@web/components/runs/compete/test-evidence";
import { useState } from "react";

function candidateEvents(
  detail: RunDetail,
  stepId: string,
  events: readonly EventEnvelope[],
): EventEnvelope[] {
  const sessionIds = new Set<string>();
  for (const session of detail.sessions) {
    if (session.step_run_id === stepId) sessionIds.add(session.id);
  }
  return events.filter(
    (event) => event.step_run_id === stepId || sessionIds.has(event.agent_session_id ?? ""),
  );
}

function CandidateDiffEvidence({
  runId,
  groupId,
  stepId,
}: {
  runId: string;
  groupId: string;
  stepId: string;
}) {
  const diff = useCompeteCandidateDiff(runId, groupId, stepId);
  if (diff.isPending) {
    return (
      <div className="flex flex-col gap-1.5">
        <Skeleton height={12} width="72%" />
        <Skeleton height={12} width="48%" />
      </div>
    );
  }
  if (diff.isError)
    return <p className="text-xs text-danger">Diff evidence could not be loaded.</p>;
  if (diff.data.diff === null) {
    return (
      <p className="text-xs text-text-tertiary">No git worktree evidence for this candidate.</p>
    );
  }
  const evidence = diff.data.diff;
  return (
    <div className="rounded-md border border-border-subtle bg-surface p-2">
      <div className="flex items-center gap-2 text-xs">
        <span>{evidence.files.length} files</span>
        <span className="text-success">+{evidence.additions}</span>
        <span className="text-danger">−{evidence.deletions}</span>
      </div>
      {evidence.files.length === 0 ? (
        <p className="mt-1 text-xs text-text-tertiary">No changes produced.</p>
      ) : (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer select-none text-iris-text">Inspect patch</summary>
          <div className="mt-2 max-h-44 space-y-2 overflow-auto">
            {evidence.files.map((file) => (
              <div key={file.path}>
                <p className="truncate font-mono text-[10px] text-text-secondary">{file.path}</p>
                <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded bg-background p-2 font-mono text-[10px] leading-4 text-text-secondary">
                  {file.patch ?? "Binary file or patch unavailable."}
                </pre>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function CandidateEvidence({
  detail,
  group,
  candidate,
  events,
  marked,
  disabled,
  onMark,
}: {
  detail: RunDetail;
  group: CompeteGroupContract;
  candidate: StepRunContract;
  events: readonly EventEnvelope[];
  marked: boolean;
  disabled: boolean;
  onMark: () => void;
}) {
  const session = detail.sessions.find((entry) => entry.step_run_id === candidate.id);
  const evidence = candidateEvents(detail, candidate.id, events);
  const tests = collectTestEvidence(evidence);
  const canWin = candidate.status === "succeeded" && group.status === "awaiting_selection";

  return (
    <article
      className={cn(
        "flex w-[min(360px,78vw)] shrink-0 flex-col overflow-hidden rounded-lg border bg-surface-1",
        marked ? "border-iris shadow-[0_0_0_1px_var(--iris-ring)]" : "border-border-subtle",
      )}
    >
      <header className="flex items-start gap-2 border-b border-border-subtle p-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-foreground">{candidate.name}</h3>
            {group.winner_step_run_id === candidate.id ? (
              <Badge variant="iris" icon={<Icon name="git-compare" aria-hidden />}>
                winner
              </Badge>
            ) : null}
          </div>
          <p className="mt-0.5 truncate font-mono text-[10px] text-text-tertiary">
            {candidate.branch ?? "No git branch"}
          </p>
        </div>
        <StepStatusChip status={candidate.status} />
      </header>

      <div className="flex flex-1 flex-col gap-3 p-3">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="text-text-tertiary">runtime</dt>
          <dd className="justify-self-end text-foreground">{session?.agent_id ?? "not started"}</dd>
          <dt className="text-text-tertiary">evidence</dt>
          <dd className="justify-self-end text-foreground">
            {candidate.worktree_status ?? "no worktree"}
          </dd>
        </dl>

        <section>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">
            Git changes
          </p>
          <CandidateDiffEvidence runId={detail.run.id} groupId={group.id} stepId={candidate.id} />
        </section>

        <CandidateTestEvidence tests={tests} />

        <CandidateProviderUsage events={evidence} />
        <CandidateRuntimeActivity events={evidence} />
      </div>

      <footer className="border-t border-border-subtle p-2.5">
        <Button
          type="button"
          variant={marked ? "primary" : "outline"}
          size="sm"
          className="w-full"
          disabled={!canWin || disabled}
          aria-pressed={marked}
          onClick={onMark}
        >
          {marked ? "Marked as winner" : "Mark as winner"}
        </Button>
      </footer>
    </article>
  );
}

export function CompeteComparison({
  detail,
  group,
  events,
}: {
  detail: RunDetail;
  group: CompeteGroupContract;
  events: readonly EventEnvelope[];
}) {
  const [markedId, setMarkedId] = useState<string | null>(null);
  const selectWinner = useSelectCompeteWinner(detail.run.id, group.id);
  const candidates = detail.steps.filter((step) => step.compete_group_id === group.id);
  const marked = candidates.find((candidate) => candidate.id === markedId) ?? null;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <header className="border-b border-border-subtle px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon name="git-compare" aria-hidden className="text-iris-text" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold text-foreground">{group.name}</h2>
            <p className="mt-0.5 text-xs text-text-tertiary">
              Compare real git and runtime evidence. Otomat does not score candidates.
            </p>
          </div>
          <CompeteGroupStatusChip status={group.status} />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto p-4">
        <div className="flex min-w-max items-stretch gap-3">
          {candidates.map((candidate) => (
            <CandidateEvidence
              key={candidate.id}
              detail={detail}
              group={group}
              candidate={candidate}
              events={events}
              marked={markedId === candidate.id}
              disabled={selectWinner.isPending}
              onMark={() => setMarkedId(candidate.id)}
            />
          ))}
        </div>
      </div>

      <footer className="flex min-h-15 items-center gap-3 border-t border-border-subtle bg-surface px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-foreground">
            {marked
              ? `${marked.name} will become the canonical result.`
              : "Mark one succeeded candidate."}
          </p>
          <p className="mt-0.5 text-[10px] text-text-tertiary">
            Dependent steps remain queued until this explicit selection completes.
          </p>
        </div>
        <Button
          type="button"
          variant="primary"
          size="sm"
          loading={selectWinner.isPending}
          disabled={!marked || group.status !== "awaiting_selection" || selectWinner.isPending}
          onClick={() => {
            if (marked) selectWinner.mutate(marked.id);
          }}
        >
          <Icon name="git-compare" aria-hidden />
          {marked ? `Select ${marked.name} as winner` : "Select winner"}
        </Button>
      </footer>
    </div>
  );
}
