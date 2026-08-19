import type { PullRequestContract } from "@otomat/domain";

/** An inbox mirror carries no attachment evidence, so only the URL names its repository. */
const PULL_REQUEST_URL = /^https?:\/\/[^/]+\/([^/]+\/[^/]+)\/pull\/\d+$/;

export function pullRequestLabel({
  url,
  number,
}: Pick<PullRequestContract, "number" | "url">): string {
  const repository = url === null ? null : (PULL_REQUEST_URL.exec(url)?.[1] ?? null);
  if (number === null) return repository ?? "Pull request";
  return repository === null ? `#${number}` : `${repository}#${number}`;
}
