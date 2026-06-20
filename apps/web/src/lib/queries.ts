import { isRunTerminal, type EventEnvelope, type StartRunRequest } from "@otomat/domain";
import type { ConnectionState } from "@otomat/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { daemon } from "./daemon";
import { mergeEvent } from "./events";

export const queryKeys = {
  health: ["health"] as const,
  projects: ["projects"] as const,
  repositories: ["repositories"] as const,
  issues: ["issues"] as const,
  issue: (id: string) => ["issues", id] as const,
  runsForIssue: (issueId: string) => ["runs", { issueId }] as const,
  run: (id: string) => ["run", id] as const,
};

export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: () => daemon.health(),
    refetchInterval: 8_000,
    refetchIntervalInBackground: true,
  });
}

export interface DaemonStatus {
  connectionState: ConnectionState;
  /** Timestamp of the last successful health response, or null if never reached. */
  lastSyncAt: number | null;
  retry: () => void;
}

export function useDaemonStatus(): DaemonStatus {
  const health = useHealth();
  let connectionState: ConnectionState = "reconnecting";
  if (health.isSuccess) connectionState = "online";
  else if (health.isError && health.fetchStatus !== "fetching") connectionState = "offline";
  return {
    connectionState,
    lastSyncAt: health.dataUpdatedAt > 0 ? health.dataUpdatedAt : null,
    retry: () => void health.refetch(),
  };
}

export function useProjects() {
  return useQuery({ queryKey: queryKeys.projects, queryFn: () => daemon.listProjects() });
}

export function useRepositories() {
  return useQuery({ queryKey: queryKeys.repositories, queryFn: () => daemon.listRepositories() });
}

export function useIssues() {
  return useQuery({ queryKey: queryKeys.issues, queryFn: () => daemon.listIssues() });
}

export function useIssue(issueId: string) {
  return useQuery({ queryKey: queryKeys.issue(issueId), queryFn: () => daemon.getIssue(issueId) });
}

export function useRunsForIssue(issueId: string) {
  return useQuery({
    queryKey: queryKeys.runsForIssue(issueId),
    queryFn: () => daemon.listRuns({ issueId }),
  });
}

export function useRunDetail(runId: string) {
  return useQuery({
    queryKey: queryKeys.run(runId),
    queryFn: () => daemon.getRun(runId),
    refetchInterval: (query) => {
      const status = query.state.data?.run.status;
      return status && isRunTerminal(status) ? false : 1_500;
    },
  });
}

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

export type RunStreamState = "connecting" | "open" | "closed" | "error";

export interface RunStream {
  events: EventEnvelope[];
  state: RunStreamState;
}

export function useRunEvents(runId: string): RunStream {
  const [events, setEvents] = useState<EventEnvelope[]>([]);
  const [state, setState] = useState<RunStreamState>("connecting");
  const closedRef = useRef(false);

  // otomat-allow-effect: open the daemon SSE run-event stream and tear it down on unmount / run change.
  useEffect(() => {
    closedRef.current = false;
    setEvents([]);
    setState("connecting");
    const subscription = daemon.subscribeRunEvents(runId, {
      onOpen: () => setState("open"),
      onEvent: (event) => setEvents((current) => mergeEvent(current, event)),
      onEnd: () => {
        closedRef.current = true;
        setState("closed");
      },
      onStreamError: () => {
        closedRef.current = true;
        setState("error");
      },
      onError: () => {
        if (!closedRef.current) setState("error");
      },
    });
    return () => subscription.close();
  }, [runId]);

  return { events, state };
}
