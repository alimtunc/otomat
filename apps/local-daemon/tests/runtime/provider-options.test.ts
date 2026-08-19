import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  providerOptionDescriptor,
  type ProviderOptionDescriptor,
  type ProviderOptionKey,
} from "@otomat/domain";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ClaudeRuntimeAdapter } from "#runtime/providers/claude/adapter";
import { claudePermissionModeStatus } from "#runtime/providers/claude/options";
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

function codexFixtures(catalog = stubFixture("codex-models.json")): void {
  process.env["OTOMAT_STUB_FIXTURES"] = JSON.stringify({
    "exec --help": stubFixture("codex-exec-help.txt"),
    "debug models --bundled": catalog,
  });
}

/** The current contract with one level entry Codex could never emit, so the refusal is tested against the shape in use. */
function malformedCatalog(directory: string): string {
  const catalog: { models: { supported_reasoning_levels?: unknown[] }[] } = JSON.parse(
    readFileSync(stubFixture("codex-models.json"), "utf8"),
  );
  const [first] = catalog.models;
  if (first === undefined) throw new Error("the codex catalog fixture must list a model");
  first.supported_reasoning_levels = [{ description: "no effort at all" }];
  const path = join(directory, "codex-models-malformed.json");
  writeFileSync(path, JSON.stringify(catalog));
  return path;
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

  it("defaults to the autonomous mode a current CLI announces, and says why", () => {
    process.env["OTOMAT_STUB_FIXTURE"] = stubFixture("claude-help-current.txt");

    const support = new ClaudeRuntimeAdapter(STUB_BIN).describeOptions(null);
    const permission = descriptor(support.options, "permission_mode");

    expect(permission?.default_value).toBe("auto");
    expect(permission?.description).toContain("`auto`");
    // Otomat sends no `--effort` unless one is chosen, so the CLI's own default stands.
    expect(descriptor(support.options, "effort")?.default_value).toBeNull();
  });

  it("falls back to acceptEdits on a CLI without `auto`, spelling out what that costs", () => {
    process.env["OTOMAT_STUB_FIXTURE"] = stubFixture("claude-help-legacy.txt");

    const permission = descriptor(
      new ClaudeRuntimeAdapter(STUB_BIN).describeOptions(null).options,
      "permission_mode",
    );

    expect(permission?.default_value).toBe("acceptEdits");
    expect(permission?.description).toContain("git push");
    expect(permission?.description).toContain("Update Claude Code");
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

  it("describes each mode in one line, and describes none it cannot", () => {
    process.env["OTOMAT_STUB_FIXTURE"] = stubFixture("claude-help-current.txt");

    const permission = descriptor(
      new ClaudeRuntimeAdapter(STUB_BIN).describeOptions(null).options,
      "permission_mode",
    );
    const described = new Map(
      (permission?.choices ?? []).map((choice) => [choice.value, choice.description]),
    );

    expect(described.get("manual")).toBe("Claude asks before making edits.");
    expect(described.get("auto")).toBe("Claude approves safe actions and pauses for risky ones.");
    expect(described.get("plan")).toBe("Claude explores and presents a plan before editing.");
    expect(described.get("acceptEdits")).toContain("Claude edits the selected code or file.");
    expect(described.get("acceptEdits")).toContain("headless run cannot give");
    expect(described.get("dontAsk")).toBeNull();
  });

  it("drops the retired `default` mode a current CLI no longer announces", () => {
    process.env["OTOMAT_STUB_FIXTURE"] = stubFixture("claude-help-current.txt");

    const support = new ClaudeRuntimeAdapter(STUB_BIN).describeOptions(null);

    expect(values(descriptor(support.options, "permission_mode"))).not.toContain("default");
  });

  it("sends an effort as `--effort`, and never invents a level the help page omits", () => {
    process.env["OTOMAT_STUB_FIXTURE"] = stubFixture("claude-help-current.txt");

    const effort = providerOptionDescriptor(
      new ClaudeRuntimeAdapter(STUB_BIN).describeOptions(null).options,
      "effort",
    );

    expect(effort?.key).toBe("effort");
    expect(values(effort ?? undefined)).not.toContain("ultra");
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

describe("claudePermissionModeStatus", () => {
  it("separates the four ways a mode can stand on the host that runs the turn", () => {
    process.env["OTOMAT_STUB_FIXTURE"] = stubFixture("claude-help-current.txt");

    expect(claudePermissionModeStatus(STUB_BIN, undefined)).toBe("unfrozen");
    expect(claudePermissionModeStatus(STUB_BIN, "auto")).toBe("autonomous");
    expect(claudePermissionModeStatus(STUB_BIN, "acceptEdits")).toBe("supervised");
    expect(claudePermissionModeStatus(STUB_BIN, "telepathy")).toBe("unannounced");
  });

  it("calls the same mode supervised on a host whose CLI has no autonomous one", () => {
    process.env["OTOMAT_STUB_FIXTURE"] = stubFixture("claude-help-legacy.txt");

    // `acceptEdits` is this host's default, so it is the autonomous one available here.
    expect(claudePermissionModeStatus(STUB_BIN, "acceptEdits")).toBe("autonomous");
    expect(claudePermissionModeStatus(STUB_BIN, "auto")).toBe("unannounced");
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
    // Otomat sends no `-c model_reasoning_effort` of its own, so nothing is frozen for it.
    expect(reasoning?.default_value).toBeNull();
    expect(reasoning?.description).toContain('Codex applies "low" itself');
  });

  it("carries each level's own description through to the picker", () => {
    codexFixtures();

    const reasoning = descriptor(
      new CodexRuntimeAdapter(STUB_BIN).describeOptions("gpt-5.6-sol").options,
      "reasoning_effort",
    );

    expect(reasoning?.choices.find((choice) => choice.value === "ultra")?.description).toBe(
      "Maximum reasoning with automatic task delegation",
    );
  });

  it("sends an effort as `model_reasoning_effort`, including `ultra` when the model announces it", () => {
    codexFixtures();

    const effort = providerOptionDescriptor(
      new CodexRuntimeAdapter(STUB_BIN).describeOptions("gpt-5.6-sol").options,
      "reasoning_effort",
    );

    expect(effort?.key).toBe("reasoning_effort");
    expect(values(effort ?? undefined)).toContain("ultra");
  });

  it("withholds `ultra` from a model whose entry does not announce it", () => {
    codexFixtures();

    const reasoning = descriptor(
      new CodexRuntimeAdapter(STUB_BIN).describeOptions("gpt-5.2").options,
      "reasoning_effort",
    );

    expect(values(reasoning)).toEqual(["low", "medium", "high", "xhigh"]);
  });

  it("reads the same levels from a catalog that still publishes bare identifiers", () => {
    codexFixtures(stubFixture("codex-models-legacy.json"));

    const reasoning = descriptor(
      new CodexRuntimeAdapter(STUB_BIN).describeOptions("gpt-5.6-sol").options,
      "reasoning_effort",
    );

    expect(values(reasoning)).toEqual(["low", "medium", "high", "xhigh", "max", "ultra"]);
    expect(reasoning?.choices.every((choice) => choice.description === null)).toBe(true);
  });

  it("invents no level from a catalog entry it cannot read, and says so", () => {
    codexFixtures(malformedCatalog(worktree));

    const support = new CodexRuntimeAdapter(STUB_BIN).describeOptions("gpt-5.6-sol");

    expect(descriptor(support.options, "reasoning_effort")).toBeUndefined();
    expect(support.detection.detail).toContain("cannot read");
    expect(descriptor(support.options, "sandbox")).toBeDefined();
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
