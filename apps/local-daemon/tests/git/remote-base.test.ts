import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, expect, it, onTestFinished } from "vitest";

import { RemoteBaseError } from "#git/errors";
import { classifyRemoteFailure, resolveBaseSha } from "#git/remote-base";

import { setupTestRepo, type TestRepo } from "../support/git.js";

let repo: TestRepo;

beforeEach(() => {
  repo = setupTestRepo();
});

afterEach(() => {
  repo.cleanup();
});

/** Publishes a commit and rewinds the local branch, leaving the remote ahead of the checkout. */
function advanceRemote(): string {
  repo.write("remote-only.md", "published elsewhere\n");
  const sha = repo.commitAll("remote moves on");
  repo.git("push", "--quiet", "origin", "main:refs/heads/main");
  repo.git("reset", "--hard", "HEAD~1");
  return sha;
}

it("resolves the remote head when the local base branch is behind", async () => {
  const published = advanceRemote();

  expect(await resolveBaseSha(repo.root, "main", false)).toBe(published);
});

it("reads the fetched tip from a ref of its own and leaves none behind", async () => {
  const published = advanceRemote();

  expect(await resolveBaseSha(repo.root, "main", false)).toBe(published);
  expect(repo.git("for-each-ref", "refs/otomat/launch")).toBe("");
});

it("ignores a local base branch that is ahead of its remote", async () => {
  const remoteHead = repo.git("rev-parse", "main").trim();
  repo.write("local-only.md", "not published\n");
  const local = repo.commitAll("local work");

  expect(await resolveBaseSha(repo.root, "main", false)).toBe(remoteHead);
  expect(await resolveBaseSha(repo.root, "main", false)).not.toBe(local);
});

it("ignores uncommitted work in the checkout and leaves it untouched", async () => {
  const published = advanceRemote();
  writeFileSync(join(repo.root, "scratch.md"), "work in progress\n");

  expect(await resolveBaseSha(repo.root, "main", false)).toBe(published);
  expect(repo.git("status", "--porcelain")).toContain("scratch.md");
});

it("reads the branch's own configured remote ref rather than assuming the branch name", async () => {
  repo.write("on-trunk.md", "trunk work\n");
  const trunk = repo.commitAll("trunk moves");
  repo.git("push", "--quiet", "origin", "main:refs/heads/trunk");
  repo.git("reset", "--hard", "HEAD~1");
  repo.git("config", "branch.main.merge", "refs/heads/trunk");

  expect(await resolveBaseSha(repo.root, "main", false)).toBe(trunk);
});

it("keeps a branch the remote never had on its own local head", async () => {
  repo.git("checkout", "-b", "local-only");
  repo.write("feature.md", "unpublished branch\n");
  const head = repo.commitAll("local branch work");

  expect(await resolveBaseSha(repo.root, "local-only", false)).toBe(head);
});

it("refuses rather than falling back when the remote cannot be read", async () => {
  repo.git("remote", "set-url", "origin", join(repo.root, "..", "gone.git"));

  await expect(resolveBaseSha(repo.root, "main", false)).rejects.toThrow(
    expect.objectContaining({
      name: "RemoteBaseError",
      message:
        '"main" could not be found on "origin"; check that the remote and the branch still exist, then retry.',
      remote: {
        failure: "not_found",
        detail: expect.stringContaining("does not appear to be a git repository"),
      },
    }),
  );
});

it("names an unresolvable host as a network failure and keeps what git said out of the message", async () => {
  repo.git("remote", "set-url", "origin", "https://otomat-unreachable.invalid/x/y.git");

  await expect(resolveBaseSha(repo.root, "main", false)).rejects.toThrow(
    expect.objectContaining({
      message:
        '"origin" could not be reached to read "main"; check this host\'s network connection and DNS, then retry.',
      remote: {
        failure: "unreachable",
        detail: expect.stringContaining("Could not resolve host: otomat-unreachable.invalid"),
      },
    }),
  );
});

/** Served from a child process: `resolveBaseSha` runs git synchronously, so a server in this process could never answer it. */
const UNAUTHORIZED_SERVER = `
  require("node:http")
    .createServer((_, res) => res.writeHead(401, { "WWW-Authenticate": 'Basic realm="otomat"' }).end())
    .listen(0, "127.0.0.1", function () { process.stdout.write(String(this.address().port)); });
`;

it("fails a remote that wants credentials instead of waiting on a prompt", async () => {
  const server = spawn(process.execPath, ["-e", UNAUTHORIZED_SERVER], {
    stdio: ["ignore", "pipe", "ignore"],
  });
  onTestFinished(() => {
    server.kill();
  });
  const port = await new Promise<string>((resolve, reject) => {
    server.stdout.once("data", (chunk: Buffer) => resolve(chunk.toString()));
    server.once("exit", (code) => reject(new Error(`401 server exited with ${code}`)));
  });
  repo.git("remote", "set-url", "origin", `http://127.0.0.1:${port}/x/y.git`);

  await expect(resolveBaseSha(repo.root, "main", false)).rejects.toThrow(
    expect.objectContaining({
      message: expect.stringContaining("refused access"),
      remote: {
        failure: "access_denied",
        detail: expect.stringContaining("terminal prompts disabled"),
      },
    }),
  );
});

it("classifies what ssh, curl and git print for a failed fetch", () => {
  expect(
    classifyRemoteFailure(
      "ssh: Could not resolve hostname github.com: nodename nor servname provided, or not known\nfatal: Could not read from remote repository.",
    ),
  ).toBe("unreachable");
  expect(classifyRemoteFailure("ssh: connect to host github.com port 22: Connection refused")).toBe(
    "unreachable",
  );
  expect(classifyRemoteFailure("git@github.com: Permission denied (publickey).")).toBe(
    "access_denied",
  );
  expect(
    classifyRemoteFailure(
      "fatal: unable to access 'https://github.com/o/r.git/': The requested URL returned error: 403",
    ),
  ).toBe("access_denied");
  expect(classifyRemoteFailure("ERROR: Repository not found.\nfatal: Could not read")).toBe(
    "not_found",
  );
  expect(classifyRemoteFailure("fatal: early EOF")).toBe("unclassified");
});

it("refuses a repository with no remote until the caller asks for the local base", async () => {
  const bare = setupTestRepo({ withoutRemote: true });
  try {
    await expect(resolveBaseSha(bare.root, "main", false)).rejects.toThrow(RemoteBaseError);
    expect(await resolveBaseSha(bare.root, "main", true)).toBe(
      bare.git("rev-parse", "main").trim(),
    );
  } finally {
    bare.cleanup();
  }
});

it("refuses a branch that tracks the local repository instead of a real remote", async () => {
  repo.git("config", "branch.main.remote", ".");

  await expect(resolveBaseSha(repo.root, "main", false)).rejects.toThrow(RemoteBaseError);
});

it("refuses to guess between several remotes when the branch has no upstream", async () => {
  repo.git("remote", "add", "mirror", repo.root);
  repo.git("config", "--unset", "branch.main.remote");

  await expect(resolveBaseSha(repo.root, "main", false)).rejects.toThrow(RemoteBaseError);
});
