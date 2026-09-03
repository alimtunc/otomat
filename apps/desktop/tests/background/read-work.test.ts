import { afterEach, expect, it, vi } from "vitest";

import { readLocalWork } from "#main/background/read-work";

const SNAPSHOT = {
  activities: [
    {
      kind: "run",
      id: "a",
      bucket: "running",
      status: "running",
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

it("reads the daemon's own activity projection", async () => {
  const reading = await readLocalWork("http://127.0.0.1:4310", async (input) => {
    expect(String(input)).toBe("http://127.0.0.1:4310/api/activity");
    return new Response(JSON.stringify(SNAPSHOT));
  });

  expect(reading).toEqual({ ok: true, summary: { active: 1, waiting: 0, failed: 0 } });
});

it("reports an unreachable daemon instead of counting it as idle", async () => {
  const reading = await readLocalWork("http://127.0.0.1:4310", () =>
    Promise.reject(new Error("connection refused")),
  );

  expect(reading.ok).toBe(false);
  expect(reading.ok ? "" : reading.message).toContain("connection refused");
});

it("has no work to read before the daemon has a URL", async () => {
  const fetchImpl = vi.fn();

  expect(await readLocalWork("", fetchImpl)).toEqual({
    ok: true,
    summary: { active: 0, waiting: 0, failed: 0 },
  });
  expect(fetchImpl).not.toHaveBeenCalled();
});

it("bounds its own read, so a wedged daemon cannot hold the close forever", async () => {
  const seen: (AbortSignal | null | undefined)[] = [];
  vi.stubGlobal("fetch", (_input: unknown, init?: RequestInit) => {
    seen.push(init?.signal);
    return Promise.resolve(new Response(JSON.stringify(SNAPSHOT)));
  });

  await readLocalWork("http://127.0.0.1:4310");

  expect(seen[0]).toBeInstanceOf(AbortSignal);
});
