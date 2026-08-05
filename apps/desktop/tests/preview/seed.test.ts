import { describe, expect, it } from "vitest";

import { seedSandbox } from "#main/preview/seed";

interface RecordedCall {
  url: string;
  body: unknown;
}

function fakeFetch(respond: (url: string, calls: RecordedCall[]) => Response): {
  calls: RecordedCall[];
  fetchImpl: typeof fetch;
} {
  const calls: RecordedCall[] = [];
  const fetchImpl = ((input: unknown, init?: RequestInit) => {
    const url = String(input);
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    calls.push({ url, body });
    return Promise.resolve(respond(url, calls));
  }) as typeof fetch;
  return { calls, fetchImpl };
}

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

  it("does nothing when the repository is already registered", async () => {
    const { calls, fetchImpl } = fakeFetch(
      () =>
        new Response(JSON.stringify({ error: "repository_already_registered" }), { status: 409 }),
    );

    const result = await seedSandbox({
      daemonUrl: "http://127.0.0.1:4319",
      repoPath: "/data/test-repo",
      fetchImpl,
    });

    expect(result).toEqual({ seeded: false, issues: 0 });
    expect(calls).toHaveLength(1);
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
