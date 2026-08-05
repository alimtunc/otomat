import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { seedSandbox } from "#main/preview/seed";

interface RecordedCall {
  url: string;
  body: unknown;
}

function fakeFetch(respond: (url: string, body: unknown) => Response): {
  calls: RecordedCall[];
  fetchImpl: typeof fetch;
} {
  const calls: RecordedCall[] = [];
  const fetchImpl = ((input: unknown, init?: RequestInit) => {
    const url = String(input);
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    calls.push({ url, body });
    return Promise.resolve(respond(url, body));
  }) as typeof fetch;
  return { calls, fetchImpl };
}

const scratchDirs: string[] = [];

function scratchRepoPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "otomat-sandbox-seed-"));
  scratchDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of scratchDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("seedSandbox", () => {
  it("registers the repository and files the fixture issues on a fresh daemon", async () => {
    const { calls, fetchImpl } = fakeFetch((url) =>
      url.endsWith("/api/repositories")
        ? new Response(JSON.stringify({ project: { id: "p-1" } }), { status: 201 })
        : new Response(JSON.stringify({ id: "i" }), { status: 201 }),
    );

    const result = await seedSandbox({
      daemonUrl: "http://127.0.0.1:4319",
      repoPath: "/data/test-repo",
      fetchImpl,
    });

    expect(result.seeded).toBe(true);
    expect(result.issues).toBeGreaterThanOrEqual(3);
    const issueCalls = calls.filter((call) => call.url.endsWith("/api/issues"));
    expect(issueCalls).toHaveLength(result.issues);
    for (const call of issueCalls) {
      expect(call.body).toMatchObject({ project_id: "p-1", title: expect.any(String) });
    }
  });

  it("does nothing when the registered repository already has issues", async () => {
    const repoPath = scratchRepoPath();
    const { calls, fetchImpl } = fakeFetch((url) => {
      if (url.endsWith("/api/repositories")) {
        return new Response(JSON.stringify({ error: "repository_already_registered" }), {
          status: 409,
        });
      }
      if (url.endsWith("/api/projects")) {
        return new Response(JSON.stringify([{ id: "p-1", root_path: realpathSync(repoPath) }]), {
          status: 200,
        });
      }
      return new Response(JSON.stringify([{ id: "i-1" }]), { status: 200 });
    });

    const result = await seedSandbox({
      daemonUrl: "http://127.0.0.1:4319",
      repoPath,
      fetchImpl,
    });

    expect(result).toEqual({ seeded: false, issues: 0 });
    expect(calls.filter((call) => call.body !== null)).toHaveLength(1);
  });

  it("re-files the fixtures when an earlier seed died before any issue landed", async () => {
    const repoPath = scratchRepoPath();
    const { calls, fetchImpl } = fakeFetch((url, body) => {
      if (url.endsWith("/api/repositories")) {
        return new Response(JSON.stringify({ error: "repository_already_registered" }), {
          status: 409,
        });
      }
      if (url.endsWith("/api/projects")) {
        return new Response(JSON.stringify([{ id: "p-1", root_path: realpathSync(repoPath) }]), {
          status: 200,
        });
      }
      if (body === null) return new Response(JSON.stringify([]), { status: 200 });
      return new Response(JSON.stringify({ id: "i" }), { status: 201 });
    });

    const result = await seedSandbox({
      daemonUrl: "http://127.0.0.1:4319",
      repoPath,
      fetchImpl,
    });

    expect(result.seeded).toBe(true);
    const issuePosts = calls.filter(
      (call) => call.url.endsWith("/api/issues") && call.body !== null,
    );
    expect(issuePosts).toHaveLength(result.issues);
    for (const call of issuePosts) {
      expect(call.body).toMatchObject({ project_id: "p-1", title: expect.any(String) });
    }
  });

  it("fails loudly on any other registration refusal", async () => {
    const { fetchImpl } = fakeFetch(
      () => new Response(JSON.stringify({ error: "path_not_git_repository" }), { status: 400 }),
    );

    await expect(
      seedSandbox({ daemonUrl: "http://127.0.0.1:4319", repoPath: "/nope", fetchImpl }),
    ).rejects.toThrow(/registration failed \(400\)/);
  });
});
