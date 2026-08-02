import { describe, expect, it } from "vitest";

import {
  createGitHubCli,
  parseGitHubRemoteUrl,
  type CommandRequest,
  type CommandResult,
} from "#github";

const ok = (stdout = ""): CommandResult => ({ stdout, stderr: "", exitCode: 0 });

function fakeRunner(results: CommandResult[]) {
  const requests: CommandRequest[] = [];
  return {
    requests,
    run: async (request: CommandRequest): Promise<CommandResult> => {
      requests.push(request);
      const result = results.shift();
      if (!result)
        throw new Error(`unexpected command: ${request.command} ${request.args.join(" ")}`);
      return result;
    },
  };
}

describe("parseGitHubRemoteUrl", () => {
  it.each([
    ["https://github.com/acme/otomat.git", "acme/otomat"],
    ["git@github.com:acme/otomat.git", "acme/otomat"],
    ["ssh://git@github.com/acme/otomat.git", "acme/otomat"],
  ])("parses %s", (url, repository) => {
    expect(parseGitHubRemoteUrl(url)).toEqual({ repository });
  });

  it.each([
    "https://gitlab.com/acme/otomat.git",
    "https://token@github.com/acme/otomat.git",
    "not-a-remote",
  ])("rejects unsupported or credential-bearing remote %s", (url) => {
    expect(parseGitHubRemoteUrl(url)).toBeNull();
  });
});

describe("GitHub CLI adapter", () => {
  it("reports when GitHub CLI is not installed", async () => {
    const runner = fakeRunner([{ stdout: "", stderr: "", exitCode: null, errorCode: "ENOENT" }]);
    const cli = createGitHubCli(runner.run);

    await expect(cli.connection()).resolves.toEqual({
      status: "not_installed",
      login: null,
      device_authorization: null,
      error_code: "github_cli_missing",
      error_message: "Install GitHub CLI to connect Otomat to GitHub.",
    });
  });

  it("reports an outdated GitHub CLI instead of a connection failure", async () => {
    const runner = fakeRunner([ok("gh version 2.45.0 (2024-01-15)\n")]);
    const cli = createGitHubCli(runner.run);

    await expect(cli.connection()).resolves.toEqual({
      status: "cli_outdated",
      login: null,
      device_authorization: null,
      error_code: "github_cli_outdated",
      error_message: "GitHub CLI 2.45.0 is too old; Otomat needs 2.63.0 or newer.",
    });
    expect(runner.requests).toHaveLength(1);
  });

  it("prefers a GitHub origin over other GitHub remotes", async () => {
    const runner = fakeRunner([
      ok("fork\norigin\n"),
      ok("git@github.com:someone/fork.git\n"),
      ok("https://github.com/acme/otomat.git\n"),
    ]);
    const cli = createGitHubCli(runner.run);

    await expect(cli.resolveRemote("/repo")).resolves.toEqual({
      name: "origin",
      repository: "acme/otomat",
    });
  });

  it("rejects a repository without a GitHub remote", async () => {
    const runner = fakeRunner([ok("origin\n"), ok("https://gitlab.com/acme/otomat.git\n")]);
    const cli = createGitHubCli(runner.run);

    await expect(cli.resolveRemote("/repo")).rejects.toMatchObject({
      code: "github_remote_missing",
    });
  });

  it("reports connected identity without requesting a token", async () => {
    const runner = fakeRunner([
      ok("gh version 2.96.0\n"),
      ok(
        JSON.stringify({
          hosts: {
            "github.com": [
              {
                state: "success",
                active: true,
                host: "github.com",
                login: "octocat",
                tokenSource: "default",
                gitProtocol: "https",
              },
            ],
          },
        }),
      ),
    ]);
    const cli = createGitHubCli(runner.run);

    await expect(cli.connection()).resolves.toEqual({
      status: "connected",
      login: "octocat",
      device_authorization: null,
      error_code: null,
      error_message: null,
    });
    expect(runner.requests.flatMap((request) => request.args)).not.toContain("--show-token");
  });

  it("uses the active valid account when another account is stale", async () => {
    const runner = fakeRunner([
      ok("gh version 2.96.0\n"),
      ok(
        JSON.stringify({
          hosts: {
            "github.com": [
              {
                state: "failure",
                active: false,
                host: "github.com",
                login: "stale-user",
              },
              {
                state: "success",
                active: true,
                host: "github.com",
                login: "octocat",
              },
            ],
          },
        }),
      ),
    ]);

    await expect(createGitHubCli(runner.run).connection()).resolves.toMatchObject({
      status: "connected",
      login: "octocat",
    });
    expect(runner.requests).toHaveLength(2);
  });

  it("reports authentication as required without exposing command output", async () => {
    const runner = fakeRunner([
      ok("gh version 2.96.0\n"),
      ok(
        JSON.stringify({
          hosts: {
            "github.com": [
              {
                state: "failure",
                active: true,
                host: "github.com",
                login: "octocat",
              },
            ],
          },
        }),
      ),
    ]);
    const cli = createGitHubCli(runner.run);

    await expect(cli.connection()).resolves.toEqual({
      status: "disconnected",
      login: null,
      device_authorization: null,
      error_code: "github_auth_required",
      error_message: "Sign in to GitHub to continue.",
    });
  });

  it("reports a failed connection when the auth status command fails", async () => {
    const runner = fakeRunner([
      ok("gh version 2.96.0\n"),
      { stdout: "", stderr: "sensitive failure", exitCode: 1 },
    ]);

    await expect(createGitHubCli(runner.run).connection()).resolves.toEqual({
      status: "failed",
      login: null,
      device_authorization: null,
      error_code: "github_auth_status_failed",
      error_message: "GitHub authentication status could not be read.",
    });
  });

  it("pushes the run branch without invoking repository pre-push hooks", async () => {
    const runner = fakeRunner([ok()]);
    const cli = createGitHubCli(runner.run);

    await cli.push("/repo", "origin", "otomat/run/r1");

    expect(runner.requests[0]).toMatchObject({
      command: "git",
      cwd: "/repo",
      args: ["push", "--no-verify", "--set-upstream", "origin", "HEAD:refs/heads/otomat/run/r1"],
    });
  });

  it("signs in with a device-flow token and configures git credentials", async () => {
    const runner = fakeRunner([
      ok(),
      ok(),
      ok("gh version 2.96.0\n"),
      ok(
        JSON.stringify({
          hosts: {
            "github.com": [
              { state: "success", active: true, host: "github.com", login: "octocat" },
            ],
          },
        }),
      ),
    ]);
    const cli = createGitHubCli(runner.run);

    await expect(cli.loginWithToken("gho_token")).resolves.toMatchObject({
      status: "connected",
      login: "octocat",
    });
    expect(runner.requests[0]).toMatchObject({
      command: "gh",
      args: ["auth", "login", "--hostname", "github.com", "--with-token"],
      stdin: "gho_token",
    });
    expect(runner.requests[1]).toMatchObject({
      command: "gh",
      args: ["auth", "setup-git", "--hostname", "github.com"],
    });
  });

  it("creates with body on stdin then reads structured provider metadata", async () => {
    const provider = {
      number: 42,
      url: "https://github.com/acme/otomat/pull/42",
      title: "Ship it",
      body: "Details",
      headRefName: "otomat/run/r1",
      baseRefName: "main",
      state: "OPEN",
      isDraft: false,
    };
    const runner = fakeRunner([ok("printed-url-is-ignored\n"), ok(JSON.stringify([provider]))]);
    const cli = createGitHubCli(runner.run);

    await cli.createPullRequest({
      cwd: "/repo",
      repository: "acme/otomat",
      head: "otomat/run/r1",
      base: "main",
      title: "Ship it",
      body: "Details",
    });
    await expect(
      cli.findPullRequest({
        cwd: "/repo",
        repository: "acme/otomat",
        head: "otomat/run/r1",
        base: "main",
      }),
    ).resolves.toMatchObject({ number: 42, lifecycle: "open" });

    expect(runner.requests[0]).toMatchObject({
      command: "gh",
      stdin: "Details",
      args: [
        "pr",
        "create",
        "--repo",
        "acme/otomat",
        "--base",
        "main",
        "--head",
        "otomat/run/r1",
        "--title",
        "Ship it",
        "--body-file",
        "-",
      ],
    });
  });
});
