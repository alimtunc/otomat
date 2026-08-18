import type { PullRequestProvenance } from "@otomat/domain";

import type { GitHubPullRequest } from "../types.js";

export interface ProvenanceInput {
  provider: GitHubPullRequest;
  /** Branches runs of this issue own here; a head on one of them is Otomat's own work. */
  otomatBranches: readonly string[];
  /** True when a stored row already mirrors this pull request as a publication Otomat made. */
  otomatPublication: boolean;
  /** Login Otomat is signed in as; null leaves every unlinked pull request unverifiable. */
  connectedLogin: string | null;
}

/** `reason` is the sentence a surface shows: a provenance is never a bare label. */
export interface ProvenanceVerdict {
  provenance: PullRequestProvenance;
  reason: string;
}

/** Ownership needs a local fact; an identity that cannot be read stays `unknown` rather than being assumed. */
export function classifyProvenance(input: ProvenanceInput): ProvenanceVerdict {
  const { provider } = input;
  if (input.otomatPublication) {
    return { provenance: "otomat", reason: "Otomat opened this pull request itself." };
  }
  if (input.otomatBranches.includes(provider.headRef)) {
    return {
      provenance: "otomat",
      reason: `Its head ${provider.headRef} is a branch a run of this issue owns.`,
    };
  }
  if (provider.authorLogin === null) {
    return {
      provenance: "unknown",
      reason: `GitHub names no author for #${provider.number}, so who owns ${provider.headRef} cannot be verified.`,
    };
  }
  if (input.connectedLogin === null) {
    return {
      provenance: "unknown",
      reason: `Otomat is not signed in to GitHub, so it cannot tell whether @${provider.authorLogin} is you.`,
    };
  }
  if (provider.authorLogin === input.connectedLogin) {
    return {
      provenance: "unknown",
      reason: `@${provider.authorLogin} opened it — the account Otomat signs in as — but no run here owns ${provider.headRef}.`,
    };
  }
  return {
    provenance: "external",
    reason: `@${provider.authorLogin} opened it on ${provider.headRef}, a branch Otomat does not own.`,
  };
}
