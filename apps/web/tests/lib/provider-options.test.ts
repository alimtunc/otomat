import type { ProviderOptionDescriptor, ProviderOptionSet } from "@otomat/domain";
import { withOptionSelection } from "@web/lib/execution/selection";
import { providerOptionValueLabel } from "@web/lib/provider-option-labels";
import {
  effectiveProviderOptionLabel,
  offersEffort,
  storedProviderOptions,
  unofferedProviderOptions,
  withEffort,
} from "@web/lib/provider-options";
import { expect, it } from "vitest";

import { providerOptionSet } from "#support/runtime-options";

const permissionMode: ProviderOptionDescriptor = {
  key: "permission_mode",
  description: "How Claude Code decides whether a tool call may proceed.",
  choices: [
    { value: "acceptEdits", description: "Auto-approves edits.", dangerous: false },
    { value: "auto", description: null, dangerous: false },
    { value: "bypassPermissions", description: "Skips every check.", dangerous: true },
  ],
  default_value: "acceptEdits",
};

const optionSet = (options: ProviderOptionDescriptor[]): ProviderOptionSet => ({
  runtime: "claude",
  model: null,
  detection: { status: "ok", detail: "Announced by `claude --help`." },
  options,
});

it("reads a stored value as the profile's, and its absence as the runtime's own", () => {
  expect(effectiveProviderOptionLabel(permissionMode, "plan")).toBe("Plan");
  expect(effectiveProviderOptionLabel(permissionMode, null)).toBe(
    "Runtime default — Edit automatically",
  );
});

it("lists stored options in the contract's key order whatever order they were written in", () => {
  const stored = storedProviderOptions({ effort: "high", permission_mode: "plan" });
  expect(stored.map((option) => option.key)).toEqual(["permission_mode", "effort"]);
});

it("surfaces a stored key the current runtime and model offer no field for", () => {
  const unoffered = unofferedProviderOptions(
    { permission_mode: "plan", effort: "high" },
    optionSet([permissionMode]),
  );
  expect(unoffered.map((option) => option.key)).toEqual(["effort"]);
});

it("reports nothing unoffered before the daemon has answered", () => {
  expect(unofferedProviderOptions({ permission_mode: "plan" }, undefined)).toEqual([]);
});

it("humanizes what the CLI announced without renaming it", () => {
  expect(providerOptionValueLabel("sandbox", "workspace-write")).toBe("Workspace write");
  expect(providerOptionValueLabel("approval_policy", "on-request")).toBe("On request");
  expect(providerOptionValueLabel("effort", "xhigh")).toBe("Extra high");
  expect(providerOptionValueLabel("effort", "ultra")).toBe("Ultra");
});

it("replaces legacy Codex controls when an approval mode is selected", () => {
  const selected = withOptionSelection(
    {
      agent: "runtime:codex",
      options: {
        sandbox: { kind: "value", value: "read-only" },
        approval_policy: { kind: "value", value: "never" },
        approvals_reviewer: { kind: "value", value: "user" },
        reasoning_effort: { kind: "value", value: "high" },
      },
    },
    "approval_mode",
    { kind: "value", value: "approve_for_me" },
  );
  expect(selected.options).toEqual({
    approval_mode: { kind: "value", value: "approve_for_me" },
    reasoning_effort: { kind: "value", value: "high" },
  });
});

it("names Claude's permission modes as Claude does, and only under that option", () => {
  expect(providerOptionValueLabel("permission_mode", "manual")).toBe("Manual");
  expect(providerOptionValueLabel("permission_mode", "default")).toBe("Manual");
  expect(providerOptionValueLabel("permission_mode", "acceptEdits")).toBe("Edit automatically");
  expect(providerOptionValueLabel("permission_mode", "plan")).toBe("Plan");
  expect(providerOptionValueLabel("permission_mode", "auto")).toBe("Auto");
  expect(providerOptionValueLabel("permission_mode", "dontAsk")).toBe("Don't ask");
  expect(providerOptionValueLabel("permission_mode", "bypassPermissions")).toBe(
    "Bypass permissions",
  );
  expect(providerOptionValueLabel("approval_policy", "default")).toBe("Default");
});

it("replaces whichever effort key the options carried, or removes it", () => {
  const options = { effort: "high", approval_mode: "auto" };

  expect(withEffort(options, "reasoning_effort", "low")).toEqual({
    reasoning_effort: "low",
    approval_mode: "auto",
  });
  expect(withEffort(options, "effort", undefined)).toEqual({ approval_mode: "auto" });
});

it("offers an effort only when the model announces that value", () => {
  const efforts = providerOptionSet({
    runtime: "codex",
    options: [
      {
        key: "reasoning_effort",
        description: "Reasoning effort",
        choices: [{ value: "high", description: null, dangerous: false }],
        default_value: null,
      },
    ],
  });

  expect(offersEffort(efforts, "high")).toBe(true);
  expect(offersEffort(efforts, "max")).toBe(false);
  expect(offersEffort(providerOptionSet(), "high")).toBe(false);
});
