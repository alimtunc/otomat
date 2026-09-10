import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, expect, it } from "vitest";

import { CodexRuntimeAdapter } from "#runtime/providers/codex/adapter";
import { MemorySink } from "#runtime/sinks";

import { runtimeRunInput, runtimeSessionRef } from "../support/runtime.js";
import {
  setupStubHarness,
  STUB_BIN,
  stubFixture,
  teardownStubHarness,
} from "../support/stub-harness.js";

let worktree: string;

beforeEach(() => {
  worktree = setupStubHarness("otomat-codex-permissions-");
  process.env.OTOMAT_STUB_FIXTURE = stubFixture("codex-frames.jsonl");
  process.env.OTOMAT_STUB_FIXTURES = JSON.stringify({
    "exec --help": stubFixture("codex-exec-help-0.153.4.txt"),
  });
  process.env.OTOMAT_STUB_ARGS_FILE = join(worktree, "args.json");
});

afterEach(() => teardownStubHarness(worktree));

it.each(["run", "resume"] as const)(
  "transmits explicit Full on %s using the installed exec contract",
  async (mode) => {
    const adapter = new CodexRuntimeAdapter(STUB_BIN);
    const input = runtimeRunInput({
      run_dir: worktree,
      cwd: worktree,
      options: { sandbox: "danger-full-access", approval_policy: "never" },
    });
    const sink = new MemorySink();
    const signal = new AbortController().signal;
    const result =
      mode === "run"
        ? await adapter.run(input, sink, signal)
        : await adapter.resume(runtimeSessionRef("thread-codex-1"), input, sink, signal);

    expect(result.status).toBe("completed");
    expect(JSON.parse(readFileSync(join(worktree, "args.json"), "utf8"))).toEqual([
      "exec",
      "--json",
      "--sandbox",
      "danger-full-access",
      "-c",
      'approval_policy="never"',
      ...(mode === "resume" ? ["resume", "thread-codex-1"] : []),
      "-",
    ]);
  },
);

it("offers only the approval policy exec can honor, without selecting it implicitly", () => {
  const support = new CodexRuntimeAdapter(STUB_BIN).describeOptions(null);
  expect(support.options.find((option) => option.key === "approval_policy")).toMatchObject({
    choices: [{ value: "never" }, { value: "on-request" }],
    default_value: null,
  });
  expect(support.detection.detail).toContain("non-interactive");
});

it("offers only the native approval modes this Codex exec can honor", () => {
  const support = new CodexRuntimeAdapter(STUB_BIN).describeOptions(null);
  expect(support.options.find((option) => option.key === "approval_mode")).toMatchObject({
    choices: [
      { value: "approve_for_me", dangerous: false },
      { value: "full_access", dangerous: true },
    ],
    default_value: null,
  });
  expect(
    support.options
      .filter((option) => ["sandbox", "approval_policy", "approvals_reviewer"].includes(option.key))
      .every((option) => option.user_configurable === false),
  ).toBe(true);
});

it.each(["run", "resume"] as const)(
  "refuses an unsupported frozen approval policy on %s",
  async (mode) => {
    const adapter = new CodexRuntimeAdapter(STUB_BIN);
    const input = runtimeRunInput({
      run_dir: worktree,
      cwd: worktree,
      options: { sandbox: "danger-full-access", approval_policy: "on-request" },
    });
    const sink = new MemorySink();
    const signal = new AbortController().signal;
    await expect(
      mode === "run"
        ? adapter.run(input, sink, signal)
        : adapter.resume(runtimeSessionRef("thread-codex-1"), input, sink, signal),
    ).rejects.toThrow(/cannot honor.*on-request/);
    expect(sink.events).toEqual([]);
  },
);

it("keeps the confined default and sends no approval override for Runtime default", async () => {
  await new CodexRuntimeAdapter(STUB_BIN).run(
    runtimeRunInput({ run_dir: worktree, cwd: worktree, options: {} }),
    new MemorySink(),
    new AbortController().signal,
  );
  expect(JSON.parse(readFileSync(join(worktree, "args.json"), "utf8"))).toEqual([
    "exec",
    "--json",
    "--sandbox",
    "workspace-write",
    "-",
  ]);
});

it("keeps a managed refusal visible and never retries with different permissions", async () => {
  const refusal = 'Error: approval_policy "never" is not allowed by requirements.toml';
  process.env.OTOMAT_STUB_FIXTURE = "";
  process.env.OTOMAT_STUB_EXIT = "1";
  process.env.OTOMAT_STUB_EXITS = JSON.stringify({ "exec --help": 0 });
  process.env.OTOMAT_STUB_STDERR = refusal;
  const sink = new MemorySink();
  const final = await new CodexRuntimeAdapter(STUB_BIN).run(
    runtimeRunInput({
      run_dir: worktree,
      cwd: worktree,
      options: { sandbox: "danger-full-access", approval_policy: "never" },
    }),
    sink,
    new AbortController().signal,
  );
  expect(final.status).toBe("failed");
  expect(final.provider_session_id).toBeNull();
  expect(sink.events.some((event) => event.payload["text"] === refusal)).toBe(true);
  expect(JSON.parse(readFileSync(join(worktree, "args.json"), "utf8"))).toContain(
    "danger-full-access",
  );
});
