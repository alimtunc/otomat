import { Button, Icon } from "@otomat/ui";
import { useCancelRunStep } from "@web/api/runs/step-mutations";

export function CancelStepButton({
  runId,
  stepId,
  className,
}: {
  runId: string;
  stepId: string;
  className?: string;
}) {
  const cancelStep = useCancelRunStep(runId);
  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      className={className}
      loading={cancelStep.isPending}
      onClick={() => cancelStep.mutate(stepId)}
    >
      <Icon name="x" aria-hidden />
      Cancel step
    </Button>
  );
}
