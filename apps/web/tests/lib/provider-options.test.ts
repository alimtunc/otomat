import type { ProviderOptionDescriptor, ProviderOptionSet } from "@otomat/domain";
import { providerOptionValueLabel } from "@web/lib/provider-option-labels";
import {
  effectiveProviderOptionLabel,
  storedProviderOptions,
  unofferedProviderOptions,
} from "@web/lib/provider-options";
import { expect, it } from "vitest";

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
  expect(effectiveProviderOptionLabel(permissionMode, null)).toBe("Runtime default — Accept edits");
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
  expect(providerOptionValueLabel("acceptEdits")).toBe("Accept edits");
  expect(providerOptionValueLabel("workspace-write")).toBe("Workspace write");
  expect(providerOptionValueLabel("on-request")).toBe("On request");
  expect(providerOptionValueLabel("dontAsk")).toBe("Don't ask");
  expect(providerOptionValueLabel("ultra")).toBe("Ultra");
});
