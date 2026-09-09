import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { runCliProcess } from "#runtime/cli/process-runner";
import { probeProviderCommand } from "#runtime/probe/command";
import { CodexRuntimeAdapter } from "#runtime/providers/codex/adapter";
import { codexApprovalArgs } from "#runtime/providers/codex/approval";
import { probeCodexSandbox } from "#runtime/providers/codex/sandbox";
import { MemorySink } from "#runtime/sinks";

import { runtimeRunInput, runtimeSessionRef } from "../support/runtime.js";
import {
  setupStubHarness,
  STUB_BIN,
  stubFixture,
  teardownStubHarness,
} from "../support/stub-harness.js";

vi.mock("#runtime/probe/command", async (original) => ({
  ...(await original<typeof import("#runtime/probe/command")>()),
  probeProviderCommand: vi.fn(),
}));
vi.mock("#runtime/providers/codex/sandbox", async (original) => ({
  ...(await original<typeof import("#runtime/providers/codex/sandbox")>()),
  probeCodexSandbox: vi.fn(),
}));

vi.mock("#runtime/cli/process-runner", () => ({ runCliProcess: vi.fn() }));

let directory: string;
beforeEach(() => {
  directory = setupStubHarness("otomat-reviewer-");
  process.env.OTOMAT_STUB_FIXTURE = stubFixture("codex-frames.jsonl");
  vi.mocked(runCliProcess).mockImplementation(async (input) => {
    input.onSpawn?.();
    const fixture = process.env.OTOMAT_STUB_FIXTURE;
    if (!fixture) throw new Error("Missing replay fixture");
    for (const line of readFileSync(fixture, "utf8").split("\n").filter(Boolean))
      input.onStdoutLine(line);
    return { code: 0, signal: null, aborted: false };
  });
  vi.mocked(probeCodexSandbox).mockReturnValue({
    status: "available",
    diagnostics: {
      host: "fixture",
      executionEnvironment: "local",
      platform: "linux",
      codexVersion: "fixture",
      args: ["sandbox", "true"],
      cwd: directory,
      exitCode: 0,
      stderr: "",
      capabilities: {
        unprivilegedUserNamespaceClone: "1",
        maxUserNamespaces: "1",
        appArmorRestrictsUnprivilegedUserNamespaces: "0",
      },
    },
  });
  vi.mocked(probeProviderCommand).mockImplementation((_binary, args) => ({
    status: "ok",
    stdout:
      args.join(" ") === "exec --help"
        ? readFileSync(stubFixture("codex-exec-help-0.153.4.txt"), "utf8")
        : "",
  }));
});
afterEach(() => {
  teardownStubHarness(directory);
  vi.resetAllMocks();
});

it.each(["read-only", "workspace-write"])(
  "preserves %s in run and resume parameters sent to the process runner",
  async (sandbox) => {
    const adapter = new CodexRuntimeAdapter(STUB_BIN);
    const options = { sandbox, approval_policy: "on-request", approvals_reviewer: "auto_review" };
    const input = runtimeRunInput({ cwd: directory, run_dir: directory, options });
    for (const mode of ["run", "resume"] as const) {
      const sink = new MemorySink();
      const result =
        mode === "run"
          ? await adapter.run(input, sink, AbortSignal.timeout(5000))
          : await adapter.resume(
              runtimeSessionRef("thread-codex-1"),
              input,
              sink,
              AbortSignal.timeout(5000),
            );
      expect(result.status).toBe("completed");
      const args = vi.mocked(runCliProcess).mock.calls.at(-1)?.[0].args;
      expect(args).toEqual([
        "exec",
        "--json",
        "--sandbox",
        sandbox,
        "-c",
        'approval_policy="on-request"',
        "-c",
        'approvals_reviewer="auto_review"',
        ...(mode === "resume" ? ["resume", "thread-codex-1"] : []),
        "-",
      ]);
      expect(
        sink.events.some(
          (event) =>
            event.source === "otomat" &&
            String(event.payload["text"]).includes(
              `Arguments sent to Codex: ${JSON.stringify(args)}`,
            ),
        ),
      ).toBe(true);
    }
  },
);

it.each([
  { sandbox: "danger-full-access", approvals_reviewer: "auto_review" },
  { sandbox: "workspace-write", approval_policy: "never", approvals_reviewer: "auto_review" },
  { approval_policy: "untrusted", approvals_reviewer: "auto_review" },
  { approval_policy: "on-failure", approvals_reviewer: "auto_review" },
  { approval_policy: "on-request", approvals_reviewer: "user" },
  { approvals_reviewer: "invented" },
])("refuses incompatible permissions before spawning: %j", async (options) => {
  const sink = new MemorySink();
  await expect(
    new CodexRuntimeAdapter(STUB_BIN).run(
      runtimeRunInput({ cwd: directory, run_dir: directory, options }),
      sink,
      AbortSignal.timeout(5000),
    ),
  ).rejects.toMatchObject({ reason: "permissions_unsupported" });
  expect(sink.events).toEqual([]);
});

it("detects the reviewer on older exec via its feature listing and validates the config spelling", () => {
  vi.mocked(probeProviderCommand).mockImplementation((_binary, args) => ({
    status: "ok",
    stdout:
      args[0] === "features"
        ? "guardian_approval stable true"
        : readFileSync(stubFixture("codex-exec-help-0.146.0.txt"), "utf8"),
  }));
  expect(codexApprovalArgs(STUB_BIN, { approvals_reviewer: "auto_review" })).toEqual([
    "-c",
    'approval_policy="on-request"',
    "-c",
    'approvals_reviewer="auto_review"',
  ]);
  expect(probeProviderCommand).toHaveBeenCalledWith(STUB_BIN, [
    "features",
    "list",
    "-c",
    'approvals_reviewer="auto_review"',
  ]);
});

it("redetects capabilities after a binary replacement and refuses a now unsupported stored reviewer", () => {
  const binary = join(directory, "binary");
  writeFileSync(binary, "current");
  expect(codexApprovalArgs(binary, { approvals_reviewer: "auto_review" })).toContain(
    'approvals_reviewer="auto_review"',
  );
  writeFileSync(binary, "older binary without reviewer");
  vi.mocked(probeProviderCommand).mockImplementation((_binary, args) =>
    args[0] === "features"
      ? { status: "unsupported", detail: "unknown command" }
      : { status: "ok", stdout: readFileSync(stubFixture("codex-exec-help-0.146.0.txt"), "utf8") },
  );
  expect(() => codexApprovalArgs(binary, { approvals_reviewer: "auto_review" })).toThrow(
    /Update the CLI.*refresh/,
  );
});

it("refuses uncertain capability detection without substituting full access", () => {
  vi.mocked(probeProviderCommand).mockReturnValue({
    status: "failed",
    detail: "probe unavailable",
  });
  expect(() => codexApprovalArgs(STUB_BIN, { approvals_reviewer: "auto_review" })).toThrow(
    /cannot honor/,
  );
});

it("keeps a simulated automatic-review refusal as a failed tool and turn without escalation", async () => {
  const refusal = "Automatic approval review denied this action: outside the authorized scope.";
  const fixture = join(directory, "denial.jsonl");
  writeFileSync(
    fixture,
    [
      { type: "thread.started", thread_id: "thread-codex-1" },
      {
        type: "item.completed",
        item: {
          id: "denied",
          type: "command_execution",
          command: "git push",
          status: "failed",
          aggregated_output: refusal,
        },
      },
      { type: "turn.failed", error: { message: refusal } },
    ]
      .map((frame) => JSON.stringify(frame))
      .join("\n"),
  );
  process.env.OTOMAT_STUB_FIXTURE = fixture;
  const sink = new MemorySink();
  const result = await new CodexRuntimeAdapter(STUB_BIN).run(
    runtimeRunInput({
      cwd: directory,
      run_dir: directory,
      options: { sandbox: "workspace-write", approvals_reviewer: "auto_review" },
    }),
    sink,
    AbortSignal.timeout(5000),
  );
  expect(result).toMatchObject({ status: "failed", error: { message: refusal } });
  expect(sink.events.find((event) => event.type === "runtime.tool_call")?.payload).toMatchObject({
    is_error: true,
    result: { output: refusal },
  });
  expect(
    sink.events.filter((event) =>
      String(event.payload["text"]).includes("Arguments sent to Codex"),
    ),
  ).toHaveLength(1);
  expect(vi.mocked(runCliProcess).mock.calls.at(-1)?.[0].args).not.toContain("danger-full-access");
});
