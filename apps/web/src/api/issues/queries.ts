import { issueSummarySchema, searchIssues } from "@otomat/domain";
import { queryOptions, skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { readCatalog } from "@web/api/catalog-read";
import { daemon } from "@web/api/client";
import type { HostQueryKeys } from "@web/api/query-keys";
import { useQueryKeys } from "@web/api/use-query-keys";

function issuesListOptions(keys: HostQueryKeys, projectId: string | undefined) {
  return queryOptions({
    queryKey: keys.issuesList(projectId),
    queryFn: () => daemon.listIssues({ projectId }),
  });
}

export function useProjectIssueSummaries(projectId: string | undefined) {
  const keys = useQueryKeys();
  const client = useQueryClient();
  return useQuery({
    queryKey: keys.issueCatalog(projectId),
    queryFn:
      projectId === undefined
        ? skipToken
        : () =>
            readCatalog(
              () => daemon.listIssueSummaries(projectId),
              async () => {
                const issues = await client.fetchQuery({
                  ...issuesListOptions(keys, projectId),
                  staleTime: 30_000,
                });
                return issues.map((issue) => issueSummarySchema.parse(issue));
              },
            ),
  });
}

export function useIssueSearch(projectId: string | undefined, query: string) {
  const keys = useQueryKeys();
  const client = useQueryClient();
  return useQuery({
    queryKey: keys.issueSearch(projectId, query),
    queryFn:
      projectId === undefined
        ? skipToken
        : () =>
            readCatalog(
              () => daemon.searchIssues(projectId, query),
              async () => {
                const issues = await client.fetchQuery({
                  ...issuesListOptions(keys, projectId),
                  staleTime: 30_000,
                });
                const matches = searchIssues(issues, query);
                return {
                  issues: matches.slice(0, 20).map((issue) => issueSummarySchema.parse(issue)),
                  total: matches.length,
                };
              },
            ),
    gcTime: 60_000,
  });
}

export function useProjectIssues(projectId: string | undefined) {
  const keys = useQueryKeys();
  return useQuery({ ...issuesListOptions(keys, projectId), enabled: projectId !== undefined });
}

export function useIssue(issueId: string | null) {
  const keys = useQueryKeys();
  return useQuery({
    queryKey: keys.issue(issueId ?? ""),
    queryFn: issueId === null ? skipToken : () => daemon.getIssue(issueId),
  });
}
