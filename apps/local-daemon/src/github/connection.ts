import type { GitHubConnectionContract } from "@otomat/domain";

import { safeGitHubFailure } from "./errors.js";
import type { GitHubCli } from "./types.js";

interface GitHubConnectionService {
  connection(): Promise<GitHubConnectionContract>;
  connect(): GitHubConnectionContract;
}

const CONNECTING: GitHubConnectionContract = {
  status: "connecting",
  login: null,
  error_code: null,
  error_message: null,
};

function failedConnection(error: unknown): GitHubConnectionContract {
  const failure = safeGitHubFailure(error, {
    code: "github_connection_failed",
    message: "GitHub connection failed unexpectedly.",
  });
  return {
    status: "failed",
    login: null,
    error_code: failure.code,
    error_message: failure.message,
  };
}

export function createGitHubConnectionService(cli: GitHubCli): GitHubConnectionService {
  let login: Promise<GitHubConnectionContract> | null = null;
  let loginFailure: GitHubConnectionContract | null = null;

  return {
    async connection() {
      if (login) return CONNECTING;
      try {
        const status = await cli.connection();
        if (status.status === "connected") loginFailure = null;
        return status.status === "connected" ? status : (loginFailure ?? status);
      } catch (error) {
        return failedConnection(error);
      }
    },
    connect() {
      if (!login) {
        loginFailure = null;
        login = cli
          .login()
          .then((status) => {
            if (status.status !== "connected") loginFailure = status;
            return status;
          })
          .catch((error: unknown) => {
            loginFailure = failedConnection(error);
            return loginFailure;
          })
          .finally(() => {
            login = null;
          });
      }
      return CONNECTING;
    },
  };
}
