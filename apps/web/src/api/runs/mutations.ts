import { DaemonRequestError } from "@otomat/client";
import {
  agentProfileErrorSchema,
  providerResumeScheduleErrorSchema,
  runResumeErrorSchema,
  runStepAppendErrorSchema,
  workspaceAbandonErrorSchema,
  type AppendRunStepRequest,
  type CreateRunContributionRequest,
  type RunContributionsResponse,
} from "@otomat/domain";
import { toast } from "@otomat/ui";
import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import type { HostQueryKeys } from "@web/api/query-keys";
import { seedContribution } from "@web/api/runs/seed/contribution";
import { seedIssueRun } from "@web/api/runs/seed/run";
import { useQueryKeys } from "@web/api/use-query-keys";
import { contributionErrorMessage } from "@web/lib/run/contribution";

export function invalidateRunCycleCaches(
  client: QueryClient,
  keys: HostQueryKeys,
  runId: string,
): void {
  client.invalidateQueries({ queryKey: keys.run(runId) });
  client.invalidateQueries({ queryKey: keys.runs });
  client.invalidateQueries({ queryKey: keys.issues });
  client.invalidateQueries({ queryKey: keys.activity });
  client.invalidateQueries({ queryKey: keys.inbox });
}

export function useAbortRun(runId: string) {
  const client = useQueryClient();
  const keys = useQueryKeys();
  return useMutation({
    mutationFn: () => daemon.abortRun(runId),
    onSuccess: () => invalidateRunCycleCaches(client, keys, runId),
    onError: () => toast.error("Could not cancel this run — is the daemon running?"),
  });
}

export function useResumeRun(runId: string) {
  const client = useQueryClient();
  const keys = useQueryKeys();
  return useMutation({
    mutationFn: () => daemon.resumeRun(runId),
    onSuccess: () => invalidateRunCycleCaches(client, keys, runId),
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

export function useScheduleProviderResume(runId: string) {
  const client = useQueryClient();
  const keys = useQueryKeys();
  return useMutation({
    mutationFn: (resumeAt: string | null) =>
      daemon.scheduleProviderResume(runId, { resume_at: resumeAt }),
    onSuccess: (detail) => {
      client.setQueryData(keys.run(runId), detail);
      invalidateRunCycleCaches(client, keys, runId);
    },
    onError: (error) => toast.error(scheduleErrorMessage(error)),
  });
}

function scheduleErrorMessage(error: unknown): string {
  if (!(error instanceof DaemonRequestError)) {
    return "Could not change this schedule — is the daemon running?";
  }
  const refusal = providerResumeScheduleErrorSchema.safeParse(error.body);
  if (refusal.success) return refusal.data.message;
  return "Could not change this schedule — the daemon refused it.";
}

export function useAbandonWorkspace(runId: string) {
  const client = useQueryClient();
  const keys = useQueryKeys();
  return useMutation({
    mutationFn: () => daemon.abandonRunWorkspace(runId),
    onSuccess: () => {
      invalidateRunCycleCaches(client, keys, runId);
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

export function useAppendRunStep(runId: string) {
  const client = useQueryClient();
  const keys = useQueryKeys();
  return useMutation({
    mutationFn: (request: AppendRunStepRequest) => daemon.appendRunStep(runId, request),
    onSuccess: (response) => {
      seedIssueRun(client, keys, response.run);
      invalidateRunCycleCaches(client, keys, runId);
    },
    onError: (error) => toast.error(appendStepErrorMessage(error)),
  });
}

export function useSelectCompeteWinner(runId: string, groupId: string) {
  const client = useQueryClient();
  const keys = useQueryKeys();
  return useMutation({
    mutationFn: (stepRunId: string) =>
      daemon.selectCompeteWinner(runId, groupId, { step_run_id: stepRunId }),
    onSuccess: (detail) => {
      client.setQueryData(keys.run(runId), detail);
      client.invalidateQueries({ queryKey: keys.run(runId) });
      client.invalidateQueries({ queryKey: keys.runs });
      toast.success("Winner selected — dependent steps can continue");
    },
    onError: (error) => {
      const message =
        error instanceof DaemonRequestError && error.status === 409
          ? "A winner was already selected. Refreshing the run."
          : "Could not select this winner — the promotion did not complete.";
      toast.error(message);
      client.invalidateQueries({ queryKey: keys.run(runId) });
    },
  });
}

function useContributionMutation<TVariables, TResult>(
  runId: string,
  mutationFn: (variables: TVariables) => Promise<TResult>,
  seed: (client: QueryClient, keys: HostQueryKeys, result: TResult) => void,
  onError?: (error: unknown) => void,
) {
  const client = useQueryClient();
  const keys = useQueryKeys();
  return useMutation({
    mutationFn,
    onSuccess: (result) => {
      seed(client, keys, result);
      client.invalidateQueries({ queryKey: keys.runContributions(runId) });
      client.invalidateQueries({ queryKey: keys.run(runId) });
      client.invalidateQueries({ queryKey: keys.runs });
    },
    onError: onError ?? ((error) => toast.error(contributionErrorMessage(error))),
  });
}

/** The composer surfaces the failure inline, so no toast doubles it. */
export function useCreateRunContribution(runId: string) {
  return useContributionMutation(
    runId,
    (request: CreateRunContributionRequest) => daemon.createRunContribution(runId, request),
    seedContribution,
    () => {},
  );
}

export function useRetryRunContribution(runId: string) {
  return useContributionMutation(
    runId,
    (contributionId: string) => daemon.retryRunContribution(runId, contributionId),
    seedContribution,
  );
}

export function useCancelRunContribution(runId: string) {
  return useContributionMutation(
    runId,
    (contributionId: string) => daemon.cancelRunContribution(runId, contributionId),
    seedContribution,
  );
}

/** The daemon never resumes a run on its own at boot, so queued messages need this explicit delivery. */
export function useDeliverRunContributions(runId: string) {
  return useContributionMutation(
    runId,
    (_: void) => daemon.deliverRunContributions(runId),
    (client, keys, response) =>
      client.setQueryData<RunContributionsResponse>(keys.runContributions(runId), response),
  );
}
