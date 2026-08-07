import type { ProviderOptionDescriptor, ProviderOptionSet } from "@otomat/domain";
import { providerOptionValueLabel } from "@web/lib/provider-option-labels";
import {
  effectiveProviderOptionLabel,
  providerOptionItems,
  providerOptionsNote,
  RUNTIME_DEFAULT_OPTION,
  storedProviderOptions,
  unofferedProviderOptions,
  withProviderOption,
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

it("names the value the runtime applies on its own, so the default is not just 'default'", () => {
  const items = providerOptionItems(permissionMode, null);
  expect(items[0]?.value).toBe(RUNTIME_DEFAULT_OPTION);
  expect(items[0]?.label).toBe("Runtime default — Accept edits");
});

it("flags a dangerous value in its own label rather than hiding it", () => {
  const labels = providerOptionItems(permissionMode, null).map((item) => item.label);
  expect(labels).toContain("Bypass permissions — dangerous");
});

it("keeps a stored value the CLI dropped in the list, marked, so the trigger never lies", () => {
  const items = providerOptionItems(permissionMode, "default");
  const dropped = items.find((item) => item.value === "default");
  expect(dropped?.stale).toBe(true);
  expect(dropped?.label).toContain("no longer offered");
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

it("removes an option entirely rather than storing an empty value", () => {
  const cleared = withProviderOption({ permission_mode: "plan" }, "permission_mode", null);
  expect(cleared).toEqual({});
  expect(withProviderOption({}, "effort", "max")).toEqual({ effort: "max" });
});

it("says where the fields come from, or why there are none", () => {
  expect(providerOptionsNote(undefined, true, false)).toMatch(/Checking/);
  expect(providerOptionsNote(undefined, false, true)).toMatch(/could not report/);
  expect(providerOptionsNote(optionSet([permissionMode]), false, false)).toMatch(/claude --help/);
  expect(providerOptionsNote(optionSet([]), false, false)).toMatch(/No option is tunable/);
});

it("humanizes what the CLI announced without renaming it", () => {
  expect(providerOptionValueLabel("acceptEdits")).toBe("Accept edits");
  expect(providerOptionValueLabel("workspace-write")).toBe("Workspace write");
  expect(providerOptionValueLabel("on-request")).toBe("On request");
  expect(providerOptionValueLabel("dontAsk")).toBe("Don't ask");
  expect(providerOptionValueLabel("ultra")).toBe("Ultra");
});
