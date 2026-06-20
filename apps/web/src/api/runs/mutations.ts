import { DaemonRequestError } from "@otomat/client";
import type { StartRunRequest } from "@otomat/domain";
import { toast } from "@otomat/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";

export function useStartRun() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (request: StartRunRequest) => daemon.startRun(request),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.issues });
      client.invalidateQueries({ queryKey: ["runs"] });
    },
  });
}

function startRunErrorMessage(error: unknown): string {
  if (error instanceof DaemonRequestError) {
    return error.status >= 500
      ? "Could not start run — the daemon failed to launch it."
      : "Could not start run — the request was rejected.";
  }
  return "Could not start run — is the daemon running?";
}

export interface StartRunAndNavigate {
  start: (request: StartRunRequest) => Promise<boolean>;
  isPending: boolean;
}

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
