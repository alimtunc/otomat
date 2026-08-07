import type { ProviderOptionChoice, ProviderOptionDescriptor } from "@otomat/domain";

import type { RuntimeOptionSupport } from "#runtime/contract";
import { cachedProviderProbe } from "#runtime/probe/cache";
import { helpFlagValues } from "#runtime/probe/help-flags";

const CLAUDE_HELP_ARGS = ["--help"] as const;

const CLAUDE_PERMISSION_MODE_FLAG = "--permission-mode";
const CLAUDE_EFFORT_FLAG = "--effort";

const DETECTION_DETAIL = "Announced by `claude --help` from the installed binary.";

/**
 * Only what the CLI itself documents. Claude Code's help page names the modes
 * but describes none of them, so a mode Otomat cannot describe from the CLI's
 * own text carries no description rather than an invented one.
 */
const PERMISSION_MODE_DESCRIPTIONS: Record<string, string> = {
  acceptEdits: "Auto-approves edits in the worktree; other gated tools still need permission.",
  plan: "Plans the work without applying it.",
  bypassPermissions: "Skips every permission check, exactly like `--dangerously-skip-permissions`.",
};

/** The one mode Claude Code itself labels dangerous: its `--dangerously-skip-permissions` twin. */
const DANGEROUS_PERMISSION_MODES = new Set(["bypassPermissions"]);

function permissionModeChoice(value: string): ProviderOptionChoice {
  return {
    value,
    description: PERMISSION_MODE_DESCRIPTIONS[value] ?? null,
    dangerous: DANGEROUS_PERMISSION_MODES.has(value),
  };
}

function permissionModeDescriptor(help: string, fallback: string): ProviderOptionDescriptor | null {
  const values = helpFlagValues(help, CLAUDE_PERMISSION_MODE_FLAG);
  if (values === null || values.length === 0) return null;
  return {
    key: "permission_mode",
    description: "How Claude Code decides whether a tool call may proceed.",
    choices: values.map(permissionModeChoice),
    // Otomat passes its own fallback when a profile picks nothing, so name it rather than let the field read as "untouched".
    default_value: values.includes(fallback) ? fallback : null,
  };
}

function effortDescriptor(help: string): ProviderOptionDescriptor | null {
  const values = helpFlagValues(help, CLAUDE_EFFORT_FLAG);
  if (values === null || values.length === 0) return null;
  return {
    key: "effort",
    description: "How much reasoning effort Claude Code spends on the session.",
    choices: values.map((value) => ({ value, description: null, dangerous: false })),
    default_value: null,
  };
}

/**
 * Feature-detected against the installed binary: an older Claude Code that
 * documents neither flag offers no options, and a probe that fails leaves the
 * runtime on its provider defaults instead of guessing a set.
 */
export function claudeOptionSupport(
  binary: string,
  permissionModeFallback: string,
): RuntimeOptionSupport {
  const probe = cachedProviderProbe(binary, CLAUDE_HELP_ARGS);
  if (probe.status !== "ok") {
    return { detection: { status: probe.status, detail: probe.detail }, options: [] };
  }
  const options = [
    permissionModeDescriptor(probe.stdout, permissionModeFallback),
    effortDescriptor(probe.stdout),
  ].filter((option): option is ProviderOptionDescriptor => option !== null);
  return { detection: { status: "ok", detail: DETECTION_DETAIL }, options };
}
