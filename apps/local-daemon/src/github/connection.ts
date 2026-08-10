import type { GitHubConnectionContract, GitHubDeviceAuthorization } from "@otomat/domain";

import type { DeviceAuthorization } from "./device-flow.js";
import { safeGitHubFailure } from "./errors.js";
import { connectionProblem } from "./parse.js";
import type { GitHubCli } from "./types.js";

interface GitHubConnectionService {
  connection(): Promise<GitHubConnectionContract>;
  connect(): GitHubConnectionContract;
}

const CONNECTING: GitHubConnectionContract = {
  status: "connecting",
  login: null,
  device_authorization: null,
  error_code: null,
  error_message: null,
};

function failedConnection(error: unknown): GitHubConnectionContract {
  const failure = safeGitHubFailure(error, {
    code: "github_connection_failed",
    message: "GitHub connection failed unexpectedly.",
  });
  return connectionProblem("failed", failure.code, failure.message);
}

export function createGitHubConnectionService(
  cli: GitHubCli,
  device: DeviceAuthorization,
): GitHubConnectionService {
  let login: Promise<GitHubConnectionContract> | null = null;
  let loginFailure: GitHubConnectionContract | null = null;
  let pendingAuthorization: GitHubDeviceAuthorization | null = null;

  // The sign-in verification code is only obtainable mid-login, so it is
  // surfaced through the polled `connecting` contract instead of a push channel.
  async function performLogin(): Promise<GitHubConnectionContract> {
    const unavailable = await cli.availability();
    if (unavailable) return unavailable;
    const start = await device.start();
    pendingAuthorization = {
      user_code: start.userCode,
      verification_url: start.verificationUrl,
    };
    const token = await device.awaitToken(start);
    return cli.loginWithToken(token);
  }

  return {
    async connection() {
      if (login) return { ...CONNECTING, device_authorization: pendingAuthorization };
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
        login = performLogin()
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
            pendingAuthorization = null;
          });
      }
      return CONNECTING;
    },
  };
}
