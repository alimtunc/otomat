import { expect, it } from "vitest";

import { providerProcessEnv } from "#runtime/cli/environment";

it("drops the daemon, worker, Electron and nested-session variables but keeps the host's", () => {
  const env = providerProcessEnv({
    PATH: "/usr/bin",
    HOME: "/home/agent",
    HTTPS_PROXY: "http://proxy:3128",
    GH_TOKEN: "gh-token",
    CODEX_HOME: "/home/agent/.codex",
    OTOMAT_WORKER_JOB_FILE: "/data/runs/r1/sessions/s1/.worker-job.json",
    OTOMAT_WORKER_START_TOKEN: "start-token",
    OTOMAT_DB_PATH: "/data/otomat.db",
    OTOMAT_DAEMON_PORT: "4320",
    OTOMAT_DAEMON_HOST: "127.0.0.1",
    OTOMAT_ALLOWED_ORIGINS: "app://otomat",
    OTOMAT_PROJECT_ROOT: "/repo",
    OTOMAT_LINEAR_API_KEY: "lin-key",
    OTOMAT_DAEMON_TOKEN: "daemon-token",
    ELECTRON_RUN_AS_NODE: "1",
    CLAUDECODE: "1",
    CLAUDE_CODE_ENTRYPOINT: "cli",
    CLAUDE_CODE_SESSION_ID: "session",
    CODEX_CI: "1",
    CODEX_REMOTE_PAYLOAD: "payload",
    CODEX_SANDBOX_NETWORK_DISABLED: "1",
    CODEX_THREAD_ID: "thread",
  });

  expect(env).toEqual({
    PATH: "/usr/bin",
    HOME: "/home/agent",
    HTTPS_PROXY: "http://proxy:3128",
    GH_TOKEN: "gh-token",
    CODEX_HOME: "/home/agent/.codex",
  });
});
