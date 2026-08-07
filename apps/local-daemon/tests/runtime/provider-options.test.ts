import type { ProviderOptionDescriptor, ProviderOptionKey } from "@otomat/domain";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ClaudeRuntimeAdapter } from "#runtime/providers/claude/adapter";
import { CodexRuntimeAdapter } from "#runtime/providers/codex/adapter";

import {
  setupStubHarness,
  STUB_BIN,
  stubFixture,
  teardownStubHarness,
} from "../support/stub-harness.js";

let worktree: string;

beforeEach(() => {
  worktree = setupStubHarness("otomat-options-");
});

afterEach(() => {
  teardownStubHarness(worktree);
});

function codexFixtures(catalog = "codex-models.json"): void {
  process.env["OTOMAT_STUB_FIXTURES"] = JSON.stringify({
    "exec --help": stubFixture("codex-exec-help.txt"),
    "debug models --bundled": stubFixture(catalog),
  });
}

function descriptor(
  options: ProviderOptionDescriptor[],
  key: ProviderOptionKey,
): ProviderOptionDescriptor | undefined {
  return options.find((option) => option.key === key);
}

const values = (option: ProviderOptionDescriptor | undefined) =>
  option?.choices.map((choice) => choice.value);

describe("claude provider options", () => {
  it("offers exactly the modes and effort levels the installed help announces", () => {
    process.env["OTOMAT_STUB_FIXTURE"] = stubFixture("claude-help-current.txt");

    const support = new ClaudeRuntimeAdapter(STUB_BIN).describeOptions(null);

    expect(support.detection.status).toBe("ok");
    expect(values(descriptor(support.options, "permission_mode"))).toEqual([
      "acceptEdits",
      "auto",
      "bypassPermissions",
      "manual",
      "dontAsk",
      "plan",
    ]);
    expect(values(descriptor(support.options, "effort"))).toEqual([
      "low",
      "medium",
      "high",
      "xhigh",
      "max",
    ]);
  });

  it("names the fallback Otomat sends itself as the permission mode's runtime default", () => {
    process.env["OTOMAT_STUB_FIXTURE"] = stubFixture("claude-help-current.txt");

    const support = new ClaudeRuntimeAdapter(STUB_BIN).describeOptions(null);

    expect(descriptor(support.options, "permission_mode")?.default_value).toBe("acceptEdits");
    // Otomat sends no `--effort` unless one is chosen, so the CLI's own default stands.
    expect(descriptor(support.options, "effort")?.default_value).toBeNull();
  });

  it("marks only bypassPermissions dangerous, and never preselects it", () => {
    process.env["OTOMAT_STUB_FIXTURE"] = stubFixture("claude-help-current.txt");

    const permission = descriptor(
      new ClaudeRuntimeAdapter(STUB_BIN).describeOptions(null).options,
      "permission_mode",
    );

    const dangerous = permission?.choices.filter((choice) => choice.dangerous) ?? [];
    expect(dangerous.map((choice) => choice.value)).toEqual(["bypassPermissions"]);
    expect(permission?.default_value).not.toBe("bypassPermissions");
  });

  it("drops the retired `default` mode a current CLI no longer announces", () => {
    process.env["OTOMAT_STUB_FIXTURE"] = stubFixture("claude-help-current.txt");

    const support = new ClaudeRuntimeAdapter(STUB_BIN).describeOptions(null);

    expect(values(descriptor(support.options, "permission_mode"))).not.toContain("default");
  });

  it("offers an older release only what that release documents", () => {
    process.env["OTOMAT_STUB_FIXTURE"] = stubFixture("claude-help-legacy.txt");

    const support = new ClaudeRuntimeAdapter(STUB_BIN).describeOptions(null);

    expect(values(descriptor(support.options, "permission_mode"))).toContain("default");
    expect(values(descriptor(support.options, "permission_mode"))).not.toContain("auto");
    expect(descriptor(support.options, "effort")).toBeUndefined();
  });

  it("offers nothing, honestly, when the help page cannot be read", () => {
    process.env["OTOMAT_STUB_EXIT"] = "1";
    process.env["OTOMAT_STUB_STDERR"] = "error: could not start claude";

    const support = new ClaudeRuntimeAdapter(STUB_BIN).describeOptions(null);

    expect(support.detection.status).toBe("failed");
    expect(support.detection.detail).toBe("error: could not start claude");
    expect(support.options).toEqual([]);
  });
});

describe("codex provider options", () => {
  it("offers the sandbox and approval policies `codex exec --help` announces", () => {
    codexFixtures();

    const support = new CodexRuntimeAdapter(STUB_BIN).describeOptions("gpt-5.6-sol");

    expect(support.detection.status).toBe("ok");
    expect(values(descriptor(support.options, "sandbox"))).toEqual([
      "read-only",
      "workspace-write",
      "danger-full-access",
    ]);
    expect(values(descriptor(support.options, "approval_policy"))).toEqual([
      "untrusted",
      "on-failure",
      "on-request",
      "never",
    ]);
  });

  it("keeps the worktree sandbox as its default and marks full access dangerous", () => {
    codexFixtures();

    const options = new CodexRuntimeAdapter(STUB_BIN).describeOptions("gpt-5.6-sol").options;
    const sandbox = descriptor(options, "sandbox");

    expect(sandbox?.default_value).toBe("workspace-write");
    const dangerous = sandbox?.choices.filter((choice) => choice.dangerous) ?? [];
    expect(dangerous.map((choice) => choice.value)).toEqual(["danger-full-access"]);
  });

  it("describes Codex's Auto preset as workspace-write plus on-request", () => {
    codexFixtures();

    const options = new CodexRuntimeAdapter(STUB_BIN).describeOptions("gpt-5.6-sol").options;
    const onRequest = descriptor(options, "approval_policy")?.choices.find(
      (choice) => choice.value === "on-request",
    );

    expect(onRequest?.description).toContain("workspace-write");
    expect(onRequest?.description).toContain("on-request");
    expect(options.some((option) => option.key === "permission_mode")).toBe(false);
  });

  it("warns that an escalating policy cannot be answered here", () => {
    codexFixtures();

    const approval = descriptor(
      new CodexRuntimeAdapter(STUB_BIN).describeOptions("gpt-5.6-sol").options,
      "approval_policy",
    );

    const escalating = approval?.choices.filter((choice) => choice.value !== "never") ?? [];
    expect(escalating.length).toBeGreaterThan(0);
    for (const choice of escalating) {
      expect(choice.description).toMatch(/non-interactively/);
    }
    // Otomat sends no `--ask-for-approval` of its own, so the CLI's default stands.
    expect(approval?.default_value).toBeNull();
  });

  it("offers the reasoning levels the bundled catalog attributes to the chosen model", () => {
    codexFixtures();

    const reasoning = descriptor(
      new CodexRuntimeAdapter(STUB_BIN).describeOptions("gpt-5.6-sol").options,
      "reasoning_effort",
    );

    expect(values(reasoning)).toEqual(["low", "medium", "high", "xhigh", "max", "ultra"]);
    expect(reasoning?.default_value).toBe("medium");
  });

  it("offers no reasoning field for a model the catalog does not describe", () => {
    codexFixtures();

    const support = new CodexRuntimeAdapter(STUB_BIN).describeOptions("my-fine-tune");

    expect(descriptor(support.options, "reasoning_effort")).toBeUndefined();
    expect(support.detection.detail).toContain("my-fine-tune");
    expect(support.detection.detail).toContain("runtime default");
  });

  it("offers no reasoning field before a model is chosen, and says why", () => {
    codexFixtures();

    const support = new CodexRuntimeAdapter(STUB_BIN).describeOptions(null);

    expect(descriptor(support.options, "reasoning_effort")).toBeUndefined();
    expect(support.detection.detail).toMatch(/pick one first/i);
    expect(descriptor(support.options, "sandbox")).toBeDefined();
  });

  it("offers nothing when the installed CLI rejects `exec --help`", () => {
    process.env["OTOMAT_STUB_EXIT"] = "2";
    process.env["OTOMAT_STUB_STDERR"] = "error: unrecognized subcommand 'exec'";

    const support = new CodexRuntimeAdapter(STUB_BIN).describeOptions("gpt-5.6-sol");

    expect(support.detection.status).toBe("unsupported");
    expect(support.options).toEqual([]);
  });
});
