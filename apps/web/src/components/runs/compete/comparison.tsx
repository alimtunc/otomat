import type { CompeteGroupContract, EventEnvelope, RunDetail } from "@otomat/domain";
import { Button, Icon, StatusChip } from "@otomat/ui";
import { useSelectCompeteWinner } from "@web/api/runs/mutations";
import { useState } from "react";

import { CandidateEvidence } from "./candidate/evidence";

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
          <StatusChip kind="compete" status={group.status} />
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
