import type { CheckoutTarget } from "@otomat/domain";
import type { QueryClient } from "@tanstack/react-query";
import type { HostQueryKeys } from "@web/api/query-keys";

export function invalidateCheckout(
  client: QueryClient,
  keys: HostQueryKeys,
  target: CheckoutTarget,
): void {
  void client.invalidateQueries({ queryKey: keys.sourceControl(target) });
  if (target.kind === "repository") {
    void client.invalidateQueries({ queryKey: keys.repositoryTree(target.id) });
    void client.invalidateQueries({ queryKey: keys.repositoryBranches(target.id) });
  } else {
    void client.invalidateQueries({ queryKey: keys.runFiles(target.id) });
    void client.invalidateQueries({ queryKey: keys.runWorkspace(target.id) });
    void client.invalidateQueries({ queryKey: keys.runCommits(target.id) });
    void client.invalidateQueries({ queryKey: keys.reviewDiffs({ kind: "run", id: target.id }) });
  }
}
