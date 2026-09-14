import { DaemonRequestError } from "@otomat/client";
import {
  agentProfileErrorSchema,
  runLaunchErrorSchema,
  type RemoteBaseRefusal,
  type RunContract,
  type RunLaunchResponse,
  type StartRunRequest,
} from "@otomat/domain";
import { toast } from "@otomat/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { seedIssueRun } from "@web/api/runs/seed/run";
import { useQueryKeys } from "@web/api/use-query-keys";
import { describeRunWait } from "@web/lib/run/wait-copy";

function useStartRun() {
  const client = useQueryClient();
  const keys = useQueryKeys();
  return useMutation({
    mutationFn: (request: StartRunRequest) => daemon.startRun(request),
    onSuccess: (launched) => {
      seedIssueRun(client, keys, launched.run);
      client.invalidateQueries({ queryKey: keys.issues });
      client.invalidateQueries({ queryKey: keys.runs });
    },
  });
}

function baseRefusalOf(error: unknown): BaseRefusal | null {
  if (!(error instanceof DaemonRequestError)) return null;
  const refusal = runLaunchErrorSchema.safeParse(error.body);
  if (!refusal.success || refusal.data.error !== "base_remote_unavailable") return null;
  const { message, remote } = refusal.data;
  return remote === null ? null : { message, remote };
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

function toastLaunched(launched: RunLaunchResponse): void {
  if (launched.wait === null) {
    toast.success("Run started");
    return;
  }
  toast.info("Run queued", { description: describeRunWait(launched.wait) });
}

export interface BaseRefusal {
  message: string;
  remote: RemoteBaseRefusal;
}

export interface LaunchRun {
  /** Null when the daemon refused the launch; the failure was toasted, or is `baseRefusal`. */
  launch: (request: StartRunRequest) => Promise<RunContract | null>;
  isPending: boolean;
  baseRefusal: BaseRefusal | null;
}

export function useLaunchRun(): LaunchRun {
  const startRun = useStartRun();

  async function launch(request: StartRunRequest): Promise<RunContract | null> {
    try {
      const launched = await startRun.mutateAsync(request);
      toastLaunched(launched);
      return launched.run;
    } catch (error) {
      if (baseRefusalOf(error) === null) toast.error(startRunErrorMessage(error));
      return null;
    }
  }

  return { launch, isPending: startRun.isPending, baseRefusal: baseRefusalOf(startRun.error) };
}
