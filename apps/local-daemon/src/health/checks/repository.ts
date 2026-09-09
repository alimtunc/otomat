import type { ProjectHealthOutcome } from "@otomat/domain";

import { isRepositoryRoot, type RepositoryBinding } from "#git";

export function repositoryCheck(binding: RepositoryBinding | null): ProjectHealthOutcome {
  if (binding === null) {
    return {
      status: "error",
      message: "No repository is registered for this project on this host.",
      remediation: "Register the project's repository path on this host.",
    };
  }

  if (!isRepositoryRoot(binding.rootPath)) {
    return {
      status: "error",
      message: `${binding.rootPath} is no longer a git repository root on this host.`,
      remediation: "Point the project at the repository's current path on this host.",
    };
  }

  return {
    status: "ready",
    message: `${binding.rootPath} is a git repository on this host.`,
    remediation: null,
  };
}
