import type { RunDetail } from "@otomat/domain";
import { mergeEventWindow } from "@web/api/runs/events";
import type { RunEventStream } from "@web/api/runs/run-event-stream";
import { useStepEventHistory } from "@web/api/runs/use-step-event-history";
import { ConversationThread } from "@web/components/runs/conversation/thread";
import { eventsForStep } from "@web/lib/run/plan";

export function StepConversationThread({
  detail,
  stream,
  stepRunId,
}: {
  detail: RunDetail;
  stream: RunEventStream;
  stepRunId: string;
}) {
  const history = useStepEventHistory(detail.run.id, stepRunId);
  const events = mergeEventWindow(history.events, eventsForStep(detail, stepRunId, stream.events));
  return (
    <ConversationThread
      detail={detail}
      stepRunId={stepRunId}
      stream={{ ...stream, events, history }}
    />
  );
}
