import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@web/api/query-keys";

export function invalidateWriteback(client: QueryClient, issueId: string): Promise<unknown> {
  return Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.linearWriteback(issueId) }),
    client.invalidateQueries({ queryKey: queryKeys.linearEditor(issueId) }),
    client.invalidateQueries({ queryKey: queryKeys.linearComments(issueId) }),
    client.invalidateQueries({ queryKey: queryKeys.issue(issueId) }),
  ]);
}
