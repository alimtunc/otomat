import type { PullRequestOverview } from "@otomat/domain";

import { pullRequest } from "./pull-request.js";

export function pullRequestOverview(
  overrides: Partial<PullRequestOverview> = {},
): PullRequestOverview {
  return {
    pull_request: pullRequest({ number: 7, head_ref: "contrib/fix", base_ref: "main" }),
    issue: null,
    repository: "acme/otomat",
    checks: [],
    reviews: [],
    commits: 3,
    changed_files: 2,
    additions: 12,
    deletions: 4,
    behind_base: false,
    merge: { methods: [], blocker: "not_authorized", reason: "Otomat does not own this branch." },
    ...overrides,
  };
}
