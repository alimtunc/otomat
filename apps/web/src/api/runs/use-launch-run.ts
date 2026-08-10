import { DaemonRequestError } from "@otomat/client";
import {
  agentProfileErrorSchema,
  runLaunchErrorSchema,
  type RunContract,
  type StartRunRequest,
} from "@otomat/domain";
import { toast } from "@otomat/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";

/** Starts a run. On success invalidates the issues and runs caches. */
function useStartRun() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (request: StartRunRequest) => daemon.startRun(request),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.issues });
      client.invalidateQueries({ queryKey: queryKeys.runs });
    },
  });
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
