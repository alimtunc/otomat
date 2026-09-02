import type { QueryClient } from "@tanstack/react-query";
import type { HostQueryKeys } from "@web/api/query-keys";

export async function invalidateWriteback(
  client: QueryClient,
  keys: HostQueryKeys,
  issueId: string,
): Promise<void> {
  await Promise.all([
    client.invalidateQueries({ queryKey: keys.linearWriteback(issueId) }),
    client.invalidateQueries({ queryKey: keys.linearEditor(issueId) }),
    client.invalidateQueries({ queryKey: keys.linearComments(issueId) }),
    client.invalidateQueries({ queryKey: keys.issue(issueId) }),
  ]);
}
