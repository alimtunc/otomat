import { describe, expect, it } from "vitest";

import {
  listRemoteRepositories,
  listRepositoriesScript,
  parseRepositoryList,
} from "#main/remote/host/repos";

const LISTING = [
  "login banner",
  "OTOMAT_REPO_HOME:/home/otomat",
  "OTOMAT_REPO:work/api",
  "OTOMAT_REPO:code/app",
  "OTOMAT_REPOS_END:-",
].join("\n");

describe("listRepositoriesScript", () => {
  it("bounds the walk by depth and prunes the heavy directories", () => {
    const script = listRepositoriesScript();

    expect(script).toContain('find "$HOME" -maxdepth 4');
    expect(script).toContain("-type d -name .git -print -prune");
    expect(script).toContain("-name node_modules");
    expect(script).toContain("OTOMAT_REPOS_END:-");
  });
});

describe("parseRepositoryList", () => {
  it("resolves each row against the host's home and sorts the listing", () => {
    expect(parseRepositoryList(LISTING)).toEqual([
      { path: "/home/otomat/code/app", label: "code/app" },
      { path: "/home/otomat/work/api", label: "work/api" },
    ]);
  });

  it("refuses a listing that never completed or never named a home", () => {
    const truncated = "OTOMAT_REPO_HOME:/home/otomat\nOTOMAT_REPO:code/app\n";

    expect(parseRepositoryList(truncated)).toBeNull();
    expect(parseRepositoryList("OTOMAT_REPO:code/app\nOTOMAT_REPOS_END:-\n")).toBeNull();
    expect(parseRepositoryList(listRepositoriesScript())).toBeNull();
  });

  it("drops the home directory itself and completes with no rows", () => {
    const rows = ["OTOMAT_REPO_HOME:/home/otomat", "OTOMAT_REPO:/home/otomat"];

    expect(parseRepositoryList([...rows, "OTOMAT_REPOS_END:-"].join("\n"))).toEqual([]);
  });
});

describe("listRemoteRepositories", () => {
  it("lists the host's repositories over one ssh round trip", async () => {
    const calls: string[] = [];

    const result = await listRemoteRepositories("otomat-vps", async (options) => {
      calls.push(options.alias);
      return { code: 0, stdout: LISTING, stderr: "" };
    });

    expect(calls).toEqual(["otomat-vps"]);
    expect(result).toEqual({
      ok: true,
      repositories: [
        { path: "/home/otomat/code/app", label: "code/app" },
        { path: "/home/otomat/work/api", label: "work/api" },
      ],
    });
  });

  it("reports a truncated listing as a failure, never as an empty list", async () => {
    const result = await listRemoteRepositories("otomat-vps", async () => ({
      code: 0,
      stdout: "OTOMAT_REPO:code/app\n",
      stderr: "",
    }));

    expect(result).toEqual({ ok: false, message: "The repository listing never completed." });
  });

  it("carries the ssh failure and refuses without a configured host", async () => {
    const failed = await listRemoteRepositories("otomat-vps", async () => ({
      code: 255,
      stdout: "",
      stderr: "ssh: Could not resolve hostname otomat-vps",
    }));
    expect(failed).toEqual({
      ok: false,
      message: "ssh: Could not resolve hostname otomat-vps",
    });

    const thrown = await listRemoteRepositories("otomat-vps", () => {
      throw new Error("ssh to otomat-vps timed out after 30000ms");
    });
    expect(thrown).toMatchObject({ ok: false });

    expect(await listRemoteRepositories(null)).toEqual({
      ok: false,
      message: "No remote host is configured.",
    });
  });
});
