import { DaemonRequestError } from "@otomat/client";
import {
  nextTurnModelErrorSchema,
  type RunDetail,
  type SetNextTurnModelRequest,
  type StepRunContract,
} from "@otomat/domain";
import { toast } from "@otomat/ui";
import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import type { HostQueryKeys } from "@web/api/query-keys";
import { invalidateRunCycleCaches } from "@web/api/runs/mutations";
import { useQueryKeys } from "@web/api/use-query-keys";
import { agentConfigRefusalMessage } from "@web/lib/agent/config-error";

function seedStepRow(
  client: QueryClient,
  keys: HostQueryKeys,
  runId: string,
  step: StepRunContract,
): void {
  client.setQueryData(keys.run(runId), (current: RunDetail | undefined) =>
    current === undefined
      ? current
      : {
          ...current,
          steps: current.steps.map((candidate) => (candidate.id === step.id ? step : candidate)),
        },
  );
}

function nextTurnModelErrorMessage(error: unknown): string {
  if (error instanceof DaemonRequestError) {
    const refusal = nextTurnModelErrorSchema.safeParse(error.body);
    if (refusal.success) return refusal.data.message;
  }
  return agentConfigRefusalMessage(error, "next-turn settings");
}

export function useSetNextTurnModel(runId: string, stepId: string) {
  const keys = useQueryKeys();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (request: SetNextTurnModelRequest) =>
      daemon.setNextTurnModel(runId, stepId, request),
    onSuccess: (step) => {
      seedStepRow(client, keys, runId, step);
      client.invalidateQueries({ queryKey: keys.run(runId) });
      toast.success(
        `Next turn will use ${step.next_turn_config?.model?.id ?? "the provider default"}`,
      );
    },
    onError: (error) => toast.error(nextTurnModelErrorMessage(error)),
  });
}

function useStepCommand<Variables>(
  runId: string,
  command: (variables: Variables) => Promise<StepRunContract>,
  message: { success: (step: StepRunContract) => string; failure: string },
) {
  const keys = useQueryKeys();
  const client = useQueryClient();
  return useMutation({
    mutationFn: command,
    onSuccess: (step) => {
      seedStepRow(client, keys, runId, step);
      invalidateRunCycleCaches(client, keys, runId);
      toast.success(message.success(step));
    },
    onError: (error) => toast.error(stepCommandErrorMessage(error, message.failure)),
  });
}

export function useOverrideStepDelivery(runId: string) {
  return useStepCommand(
    runId,
    (variables: { stepId: string; note: string }) =>
      daemon.overrideStepDelivery(runId, variables.stepId, { note: variables.note }),
    {
      success: (step) => `${step.name} accepted — the run history records the override.`,
      failure: "Could not accept this step",
    },
  );
}

function stepCommandErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof DaemonRequestError) {
    const body = error.body;
    if (
      typeof body === "object" &&
      body !== null &&
      "message" in body &&
      typeof body.message === "string"
    ) {
      return body.message;
    }
  }
  return `${fallback} — is the daemon running?`;
}

export function useStopRunStep(runId: string) {
  return useStepCommand(runId, (stepId: string) => daemon.stopRunStep(runId, stepId), {
    success: () => "Step stopped — your next message resumes the same session.",
    failure: "Could not stop this step",
  });
}

export function useCancelRunStep(runId: string) {
  return useStepCommand(runId, (stepId: string) => daemon.cancelRunStep(runId, stepId), {
    success: (step) => `${step.name} canceled — it will not run.`,
    failure: "Could not cancel this step",
  });
}
