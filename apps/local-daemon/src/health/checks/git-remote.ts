import type { ProjectHealthOutcome } from "@otomat/domain";

import { branchExists, isRepositoryRoot, probeRemoteBranch, type RepositoryBinding } from "#git";

export function gitRemoteCheck(binding: RepositoryBinding | null): ProjectHealthOutcome {
  if (binding === null || !isRepositoryRoot(binding.rootPath)) {
    return {
      status: "unknown",
      message: "No usable repository is attached here, so no base branch could be read.",
      remediation: "Register or repair this project's repository on this host.",
    };
  }

  const { rootPath, defaultBranch } = binding;
  if (!branchExists(rootPath, defaultBranch)) {
    return {
      status: "error",
      message: `The base branch "${defaultBranch}" does not exist in ${rootPath}.`,
      remediation: `Create or check out "${defaultBranch}" on this host.`,
    };
  }

  const probe = probeRemoteBranch(rootPath, defaultBranch);
  switch (probe.status) {
    case "reachable":
      return {
        status: "ready",
        message: `"${defaultBranch}" is readable from "${probe.remote}".`,
        remediation: null,
      };
    case "local_only":
      return {
        status: "warning",
        message: `"${probe.remote}" does not advertise "${defaultBranch}"; runs would fork from the local branch.`,
        remediation: `Push "${defaultBranch}" to "${probe.remote}", or keep launching from the local base.`,
      };
    case "no_remote":
      return {
        status: "error",
        message: `${rootPath} has no git remote, so a run is refused unless it is launched from the local base.`,
        remediation: "Add a git remote to this repository on this host.",
      };
    case "no_upstream":
      return {
        status: "error",
        message: `"${defaultBranch}" tracks no remote in ${rootPath}, so runs cannot read a remote base.`,
        remediation: `Set the upstream of "${defaultBranch}" to one of this repository's remotes.`,
      };
    case "timed_out":
      return {
        status: "unknown",
        message: `"${probe.remote}" did not answer in time, so "${defaultBranch}" could not be read.`,
        remediation: "Check this host's network access to that remote, then re-run the check.",
      };
    case "unreadable":
      return {
        status: "error",
        message: probe.reason,
        remediation: "Check this host's network access and git credentials for that remote.",
      };
  }
}
