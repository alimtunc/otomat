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
  return "Could not set the model for the next turn.";
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

function stopStepErrorMessage(error: unknown): string {
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
  return "Could not stop this step — is the daemon running?";
}

export function useStopRunStep(runId: string) {
  const keys = useQueryKeys();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (stepId: string) => daemon.stopRunStep(runId, stepId),
    onSuccess: (step) => {
      seedStepRow(client, keys, runId, step);
      invalidateRunCycleCaches(client, keys, runId);
      toast.success("Step stopped — your next message resumes the same session.");
    },
    onError: (error) => toast.error(stopStepErrorMessage(error)),
  });
}
