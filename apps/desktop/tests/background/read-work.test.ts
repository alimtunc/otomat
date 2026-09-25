import { afterEach, expect, it, vi } from "vitest";

import { readLocalWork } from "#main/background/read-work";

const LOCAL = { baseUrl: "http://127.0.0.1:4310", token: "local-token" };

const SNAPSHOT = {
  activities: [
    {
      kind: "run",
      id: "a",
      bucket: "running",
      status: "running",
      started_at: "2026-09-03T09:00:00.000Z",
      project: { id: "project-1", name: "Otomat" },
      issue: { id: "issue-1", identifier: "OTO-1", title: "Title" },
      run_id: "run-a",
      phase: null,
      updated_at: "2026-09-03T10:00:00.000Z",
    },
  ],
  observed_at: "2026-09-03T10:00:01.000Z",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

it("reads activity and independent terminal sessions for window-close protection", async () => {
  const reading = await readLocalWork(LOCAL, async (input) => {
    if (String(input).endsWith("/api/terminals"))
      return Response.json({
        instance: "00000000-0000-4000-8000-000000000000",
        sessions: [
          {
            id: "00000000-0000-4000-8000-000000000001",
            issue_id: "issue-1",
            project_id: "local-default",
            worktree_id: "workspace-1",
            path: "/tmp/worktree",
            branch: "feature",
            tool: null,
            state: "running",
            started_at: "2026-09-03T09:00:00.000Z",
            exit_code: null,
            signal: null,
          },
        ],
      });
    expect(String(input)).toBe("http://127.0.0.1:4310/api/activity");
    return new Response(JSON.stringify(SNAPSHOT));
  });

  expect(reading).toEqual({
    ok: true,
    items: [
      {
        run_id: "run-a",
        project: "Otomat",
        issue: "OTO-1",
        state: "running",
        started_at: "2026-09-03T09:00:00.000Z",
      },
      {
        run_id: null,
        project: "feature",
        issue: "User terminal",
        state: "running",
        started_at: "2026-09-03T09:00:00.000Z",
      },
    ],
  });
});

it("reports an unreachable daemon instead of counting it as idle", async () => {
  const reading = await readLocalWork(LOCAL, () => Promise.reject(new Error("connection refused")));

  expect(reading.ok).toBe(false);
  expect(reading.ok ? "" : reading.message).toContain("connection refused");
});

it("has no work to read before the daemon started", async () => {
  const fetchImpl = vi.fn();

  expect(await readLocalWork(null, fetchImpl)).toEqual({ ok: true, items: [] });
  expect(fetchImpl).not.toHaveBeenCalled();
});

it("bounds its own read, so a wedged daemon cannot hold the close forever", async () => {
  const seen: (AbortSignal | null | undefined)[] = [];
  vi.stubGlobal("fetch", (_input: unknown, init?: RequestInit) => {
    seen.push(init?.signal);
    return Promise.resolve(new Response(JSON.stringify(SNAPSHOT)));
  });

  await readLocalWork(LOCAL);

  expect(seen[0]).toBeInstanceOf(AbortSignal);
});
