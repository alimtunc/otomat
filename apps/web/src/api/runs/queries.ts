import { DaemonRequestError } from "@otomat/client";
import { isRunSettled, runSummarySchema } from "@otomat/domain";
import { queryOptions, skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { readCatalog } from "@web/api/catalog-read";
import { daemon } from "@web/api/client";
import type { HostQueryKeys } from "@web/api/query-keys";
import { RunEventsContext } from "@web/api/runs/run-event-stream";
import { useQueryKeys } from "@web/api/use-query-keys";
import { useContext } from "react";

// The run stream refreshes the detail on every structural event; the poll only covers scheduler-side waits.
const STREAMED_POLL_MS = 5_000;
const UNSTREAMED_POLL_MS = 1_500;

export function runsForIssueOptions(keys: HostQueryKeys, issueId: string | null) {
  return queryOptions({
    queryKey: keys.runsForIssue(issueId),
    queryFn: issueId === null ? skipToken : () => daemon.listRuns({ issueId }),
  });
}

export function runDetailOptions(keys: HostQueryKeys, runId: string) {
  return queryOptions({ queryKey: keys.run(runId), queryFn: () => daemon.getRun(runId) });
}

export function useProjectRuns(projectId: string | undefined) {
  const keys = useQueryKeys();
  const client = useQueryClient();
  return useQuery({
    queryKey: keys.runCatalog(projectId),
    queryFn:
      projectId === undefined
        ? skipToken
        : () =>
            readCatalog(
              () => daemon.listRunSummaries(projectId),
              async () => {
                const runs = await client.fetchQuery({
                  queryKey: keys.runsList(projectId),
                  queryFn: () => daemon.listRuns({ projectId }),
                  staleTime: 30_000,
                });
                return runs.map((run) => runSummarySchema.parse(run));
              },
            ),
  });
}

export function useRunsForIssue(issueId: string | null) {
  const keys = useQueryKeys();
  return useQuery(runsForIssueOptions(keys, issueId));
}

export function useRunCommits(runId: string, enabled: boolean) {
  const keys = useQueryKeys();
  return useQuery({
    queryKey: keys.runCommits(runId),
    queryFn: () => daemon.getRunCommits(runId),
    enabled,
  });
}

/** Read from the daemon, never summed from the event page the cockpit happens to have loaded. */
export function useRunUsage(runId: string) {
  const keys = useQueryKeys();
  return useQuery({
    queryKey: keys.runUsage(runId),
    queryFn: () => daemon.getRunUsage(runId),
  });
}

export function useCompeteCandidateDiff(runId: string, groupId: string, stepId: string) {
  const keys = useQueryKeys();
  return useQuery({
    queryKey: keys.competeCandidateDiff(runId, groupId, stepId),
    queryFn: () => daemon.getCompeteCandidateDiff(runId, groupId, stepId),
  });
}

export function useRunDetail(runId: string) {
  const keys = useQueryKeys();
  const stream = useContext(RunEventsContext);
  const streamed = stream?.runId === runId && stream.state === "open";
  return useQuery({
    ...runDetailOptions(keys, runId),
    refetchInterval: (query) => {
      if (query.state.error instanceof DaemonRequestError) return false;
      const status = query.state.data?.run.status;
      if (status && isRunSettled(status)) return false;
      return streamed ? STREAMED_POLL_MS : UNSTREAMED_POLL_MS;
    },
  });
}

/** Never cached: the confirmation must show the branch as it is now, not as it was cached. */
export function useRunWorkspace(runId: string, enabled: boolean) {
  const keys = useQueryKeys();
  return useQuery({
    queryKey: keys.runWorkspace(runId),
    queryFn: () => daemon.getRunWorkspace(runId),
    enabled,
    staleTime: 0,
  });
}

export function useRunContributions(runId: string) {
  const keys = useQueryKeys();
  return useQuery({
    queryKey: keys.runContributions(runId),
    queryFn: () => daemon.listRunContributions(runId),
  });
}

export function useRunInteractions(runId: string) {
  const keys = useQueryKeys();
  return useQuery({
    queryKey: keys.runInteractions(runId),
    queryFn: () => daemon.listRunInteractions(runId),
  });
}

/** The dossier is frozen when the session starts, so it never refetches. */
export function useSessionContext(runId: string, agentSessionId: string, enabled: boolean) {
  const keys = useQueryKeys();
  return useQuery({
    queryKey: keys.sessionContext(runId, agentSessionId),
    queryFn: () => daemon.getSessionContext(runId, agentSessionId),
    enabled,
    staleTime: Infinity,
  });
}

export function useRunCompletionReport(runId: string) {
  const keys = useQueryKeys();
  return useQuery({
    queryKey: keys.runCompletionReport(runId),
    queryFn: () => daemon.getRunCompletionReport(runId),
  });
}
