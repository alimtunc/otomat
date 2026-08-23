import { ErrorState, Pill, PillTabs, Skeleton } from "@otomat/ui";
import { useRunDetail } from "@web/api/runs/queries";
import { useRunEventStream } from "@web/api/runs/run-event-stream";
import { ConversationHeader } from "@web/components/runs/conversation/header";
import { StepConversationThread } from "@web/components/runs/conversation/step-thread";
import { selectedStepRunId } from "@web/lib/run/plan";

export function ConversationSection({
  runId,
  selectedStepId,
  onSelectStep,
}: {
  runId: string;
  selectedStepId: string | null;
  onSelectStep: (stepId: string) => void;
}) {
  const detail = useRunDetail(runId);
  const stream = useRunEventStream();

  if (detail.isPending) {
    return (
      <div className="flex flex-col gap-2 p-4">
        <Skeleton height={14} width="60%" />
        <Skeleton height={14} width="40%" />
      </div>
    );
  }

  if (detail.isError) {
    return (
      <ErrorState
        variant="inline"
        title="Couldn’t load this run"
        onRetry={() => void detail.refetch()}
      />
    );
  }

  const selected = selectedStepRunId(detail.data, stream.events, selectedStepId ?? undefined);
  if (selected === null) return null;

  return (
    <div className="flex max-h-150 flex-col">
      <div className="flex overflow-x-auto border-b border-border-subtle p-2">
        <PillTabs
          type="single"
          value={selected}
          onValueChange={(value) => {
            if (value !== "") onSelectStep(value);
          }}
          aria-label="Step conversations"
        >
          {detail.data.steps
            .toSorted((left, right) => left.idx - right.idx)
            .map((step) => (
              <Pill key={step.id} value={step.id}>
                {step.name}
              </Pill>
            ))}
        </PillTabs>
      </div>
      <ConversationHeader detail={detail.data} stepRunId={selected} />
      <StepConversationThread detail={detail.data} stream={stream} stepRunId={selected} />
    </div>
  );
}
