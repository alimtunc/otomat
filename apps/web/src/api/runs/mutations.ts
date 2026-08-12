import { DaemonRequestError } from "@otomat/client";
import {
  agentProfileErrorSchema,
  runResumeErrorSchema,
  runStepAppendErrorSchema,
  workspaceAbandonErrorSchema,
  type AppendRunStepRequest,
  type CreateRunContributionRequest,
} from "@otomat/domain";
import { toast } from "@otomat/ui";
import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";

/** Every cycle command drops the same caches: the issue's join in, because it decides what can still be continued. */
function invalidateRunCycleCaches(client: QueryClient, runId: string): void {
  client.invalidateQueries({ queryKey: queryKeys.run(runId) });
  client.invalidateQueries({ queryKey: queryKeys.runs });
  client.invalidateQueries({ queryKey: queryKeys.issues });
}

export function useAbortRun(runId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => daemon.abortRun(runId),
    onSuccess: () => invalidateRunCycleCaches(client, runId),
    onError: () => toast.error("Could not cancel this run — is the daemon running?"),
  });
}

export function useResumeRun(runId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => daemon.resumeRun(runId),
    onSuccess: () => invalidateRunCycleCaches(client, runId),
    onError: (error) => toast.error(resumeErrorMessage(error)),
  });
}

function resumeErrorMessage(error: unknown): string {
  if (!(error instanceof DaemonRequestError)) {
    return "Could not resume this run — is the daemon running?";
  }
  const refusal = runResumeErrorSchema.safeParse(error.body);
  if (refusal.success) return refusal.data.message;
  return "Could not resume this run — the daemon refused it.";
}

export function useAbandonWorkspace(runId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => daemon.abandonRunWorkspace(runId),
    onSuccess: () => {
      invalidateRunCycleCaches(client, runId);
      toast.success("Workspace abandoned — the next launch starts a fresh cycle.");
    },
    onError: (error) => toast.error(abandonErrorMessage(error)),
  });
}

function abandonErrorMessage(error: unknown): string {
  if (!(error instanceof DaemonRequestError)) {
    return "Could not abandon this workspace — is the daemon running?";
  }
  const refusal = workspaceAbandonErrorSchema.safeParse(error.body);
  if (refusal.success) return refusal.data.message;
  return "Could not abandon this workspace — the daemon refused it.";
}

function appendStepErrorMessage(error: unknown): string {
  if (error instanceof DaemonRequestError) {
    const refusal = runStepAppendErrorSchema.safeParse(error.body);
    if (refusal.success) return refusal.data.message;
    const profile = agentProfileErrorSchema.safeParse(error.body);
    if (profile.success) return profile.data.message;
    return error.status >= 500
      ? "Could not add the step — the daemon failed to record it."
      : "Could not add the step — the request was rejected.";
  }
  return "Could not add the step — is the daemon running?";
}

/** Appends a step to the issue's canonical run; the daemon runs it in that same workspace. */
export function useAppendRunStep(runId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (request: AppendRunStepRequest) => daemon.appendRunStep(runId, request),
    onSuccess: () => invalidateRunCycleCaches(client, runId),
    onError: (error) => toast.error(appendStepErrorMessage(error)),
  });
}

export function useSelectCompeteWinner(runId: string, groupId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (stepRunId: string) =>
      daemon.selectCompeteWinner(runId, groupId, { step_run_id: stepRunId }),
    onSuccess: (detail) => {
      client.setQueryData(queryKeys.run(runId), detail);
      client.invalidateQueries({ queryKey: queryKeys.run(runId) });
      client.invalidateQueries({ queryKey: queryKeys.runs });
      toast.success("Winner selected — dependent steps can continue");
    },
    onError: (error) => {
      const message =
        error instanceof DaemonRequestError && error.status === 409
          ? "A winner was already selected. Refreshing the run."
          : "Could not select this winner — the promotion did not complete.";
      toast.error(message);
      client.invalidateQueries({ queryKey: queryKeys.run(runId) });
    },
  });
}

function useContributionMutation<TVariables>(
  runId: string,
  mutationFn: (variables: TVariables) => Promise<unknown>,
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.runContributions(runId) });
      client.invalidateQueries({ queryKey: queryKeys.run(runId) });
      client.invalidateQueries({ queryKey: queryKeys.runs });
    },
    onError: (error) => toast.error(contributionErrorMessage(error)),
  });
}

/** Posts a message to the run's conversation. The daemon persists it whatever the run is doing, so success never implies delivery. */
export function useCreateRunContribution(runId: string) {
  return useContributionMutation(runId, (request: CreateRunContributionRequest) =>
    daemon.createRunContribution(runId, request),
  );
}

/** Retries one failed message that never reached the agent. */
export function useRetryRunContribution(runId: string) {
  return useContributionMutation(runId, (contributionId: string) =>
    daemon.retryRunContribution(runId, contributionId),
  );
}

export function useCancelRunContribution(runId: string) {
  return useContributionMutation(runId, (contributionId: string) =>
    daemon.cancelRunContribution(runId, contributionId),
  );
}

/** Explicit "deliver now" for messages a daemon restart left queued; the daemon never resumes a run on its own at boot. */
export function useDeliverRunContributions(runId: string) {
  return useContributionMutation<void>(runId, () => daemon.deliverRunContributions(runId));
}

function contributionErrorMessage(error: unknown): string {
  if (error instanceof DaemonRequestError) {
    if (error.status === 409) {
      return "The daemon refused this — the run moved on since this view loaded.";
    }
    return error.status >= 500
      ? "The daemon failed to record this message."
      : "The daemon rejected this request.";
  }
  return "Could not reach the daemon — is it running?";
}
