import { DaemonRequestError } from "@otomat/client";
import {
  agentProfileErrorSchema,
  runLaunchErrorSchema,
  type CreateRunContributionRequest,
  type RunContract,
  type StartRunRequest,
} from "@otomat/domain";
import { toast } from "@otomat/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";

/** Starts a run. On success invalidates the issues and runs caches. */
export function useStartRun() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (request: StartRunRequest) => daemon.startRun(request),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.issues });
      client.invalidateQueries({ queryKey: queryKeys.runs });
    },
  });
}

function useRunCommand(runId: string, command: () => Promise<unknown>, errorMessage: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: command,
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.run(runId) });
      client.invalidateQueries({ queryKey: queryKeys.runs });
    },
    onError: () => toast.error(errorMessage),
  });
}

/** Aborts the run. On success invalidates its detail and the runs list; toasts on failure. */
export function useAbortRun(runId: string) {
  return useRunCommand(
    runId,
    () => daemon.abortRun(runId),
    "Could not abort run — is the daemon running?",
  );
}

/** Resumes the run. On success invalidates its detail and the runs list; toasts on failure. */
export function useResumeRun(runId: string) {
  return useRunCommand(
    runId,
    () => daemon.resumeRun(runId),
    "Could not resume run — it may no longer be resumable.",
  );
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
      // A message the daemon only re-queues emits no ledger event, so the SSE path cannot refresh this cache.
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

/** Explicit "deliver now" for messages a daemon restart left queued; the daemon never resumes a run on its own at boot. */
export function useDeliverRunContributions(runId: string) {
  return useContributionMutation<void>(runId, () => daemon.deliverRunContributions(runId));
}

function contributionErrorMessage(error: unknown): string {
  if (error instanceof DaemonRequestError) {
    if (error.status === 409) {
      return "Could not send this message — the daemon refused it as already delivered.";
    }
    return error.status >= 500
      ? "Could not send this message — the daemon failed to record it."
      : "Could not send this message — the request was rejected.";
  }
  return "Could not send this message — is the daemon running?";
}

function startRunErrorMessage(error: unknown): string {
  if (error instanceof DaemonRequestError) {
    const launchRefusal = runLaunchErrorSchema.safeParse(error.body);
    if (launchRefusal.success) return launchRefusal.data.message;
    const refusal = agentProfileErrorSchema.safeParse(error.body);
    if (refusal.success) return refusal.data.message;
    return error.status >= 500
      ? "Could not start run — the daemon failed to launch it."
      : "Could not start run — the request was rejected.";
  }
  return "Could not start run — is the daemon running?";
}

export interface LaunchRun {
  /** Resolves the started run, or null when the daemon refused it (an error toast was shown). */
  launch: (request: StartRunRequest) => Promise<RunContract | null>;
  isPending: boolean;
}

/** Toasts the outcome and hands the run back; where the user goes next belongs to the surface that launched it. */
export function useLaunchRun(): LaunchRun {
  const startRun = useStartRun();

  async function launch(request: StartRunRequest): Promise<RunContract | null> {
    try {
      const run = await startRun.mutateAsync(request);
      toast.success("Run started");
      return run;
    } catch (error) {
      toast.error(startRunErrorMessage(error));
      return null;
    }
  }

  return { launch, isPending: startRun.isPending };
}
