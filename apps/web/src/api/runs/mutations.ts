import { DaemonRequestError } from "@otomat/client";
import type { FollowUpRunRequest, StartRunRequest } from "@otomat/domain";
import { toast } from "@otomat/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
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

/** Sends a user follow-up prompt as a new resume turn. On success invalidates the run's detail and the runs list; toasts on failure. */
export function useFollowUpRun(runId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (request: FollowUpRunRequest) => daemon.followUpRun(runId, request),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.run(runId) });
      client.invalidateQueries({ queryKey: queryKeys.runs });
    },
    onError: (error) => toast.error(followUpErrorMessage(error)),
  });
}

export function followUpErrorMessage(error: unknown): string {
  if (error instanceof DaemonRequestError) {
    if (error.status === 409) {
      return "Could not send follow-up — the run is no longer resumable.";
    }
    return error.status >= 500
      ? "Could not send follow-up — the daemon failed to resume the run."
      : "Could not send follow-up — the request was rejected.";
  }
  return "Could not send follow-up — is the daemon running?";
}

export function startRunErrorMessage(error: unknown): string {
  if (error instanceof DaemonRequestError) {
    return error.status >= 500
      ? "Could not start run — the daemon failed to launch it."
      : "Could not start run — the request was rejected.";
  }
  return "Could not start run — is the daemon running?";
}

export interface StartRunAndNavigate {
  /** Resolves true when the run started and navigation fired; false when it failed (an error toast was shown). */
  start: (request: StartRunRequest) => Promise<boolean>;
  isPending: boolean;
}

/**
 * Starts a run and, on success, toasts and navigates to its detail route; on
 * failure shows an error toast keyed to the daemon response. `start` resolves
 * true/false accordingly.
 */
export function useStartRunAndNavigate(): StartRunAndNavigate {
  const startRun = useStartRun();
  const navigate = useNavigate();

  async function start(request: StartRunRequest): Promise<boolean> {
    try {
      const run = await startRun.mutateAsync(request);
      toast.success("Run started");
      navigate({ to: "/runs/$runId", params: { runId: run.id } });
      return true;
    } catch (error) {
      toast.error(startRunErrorMessage(error));
      return false;
    }
  }

  return { start, isPending: startRun.isPending };
}
