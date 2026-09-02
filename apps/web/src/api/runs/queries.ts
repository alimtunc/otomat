import { isRunSettled } from "@otomat/domain";
import { useQuery } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { useQueryKeys } from "@web/api/use-query-keys";

export function useProjectRuns(projectId: string | undefined) {
  const keys = useQueryKeys();
  return useQuery({
    queryKey: keys.runsList(projectId),
    queryFn: () => daemon.listRuns({ projectId }),
    enabled: projectId !== undefined,
  });
}

export function useRunsForIssue(issueId: string) {
  const keys = useQueryKeys();
  return useQuery({
    queryKey: keys.runsForIssue(issueId),
    queryFn: () => daemon.listRuns({ issueId }),
  });
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
  return useQuery({
    queryKey: keys.run(runId),
    queryFn: () => daemon.getRun(runId),
    refetchInterval: (query) => {
      const status = query.state.data?.run.status;
      return status && isRunSettled(status) ? false : 1_500;
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
