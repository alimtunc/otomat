import type {
  CompeteGroupContract,
  EventEnvelope,
  RunDetail,
  StepRunContract,
} from "@otomat/domain";
import { Badge, Button, cn, Icon, StepStatusChip } from "@otomat/ui";
import { EvidenceSection } from "@web/components/runs/compete/evidence-section";
import { eventsForStep } from "@web/lib/run-plan";
import { collectTestEvidence } from "@web/lib/test-evidence";
import { useMemo } from "react";

import { CandidateDiffEvidence } from "./diff-evidence";
import { CandidateProviderUsage, CandidateRuntimeActivity } from "./runtime-evidence";
import { CandidateTestEvidence } from "./test-evidence";

export function CandidateEvidence({
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
  const evidence = useMemo(
    () => eventsForStep(detail, candidate.id, events),
    [detail, candidate.id, events],
  );
  const tests = useMemo(() => collectTestEvidence(evidence), [evidence]);
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

        <EvidenceSection label="Git changes">
          <CandidateDiffEvidence runId={detail.run.id} groupId={group.id} stepId={candidate.id} />
        </EvidenceSection>
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
