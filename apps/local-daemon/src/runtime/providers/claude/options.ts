import {
  providerOptionDefault,
  providerOptionDescriptor,
  type PermissionModeStatus,
  type ProviderOptionChoice,
  type ProviderOptionDescriptor,
} from "@otomat/domain";

import type { RuntimeOptionSupport } from "#runtime/contract";
import { cachedProviderProbe } from "#runtime/probe/cache";
import { helpFlagValues } from "#runtime/probe/help-flags";

const CLAUDE_HELP_ARGS = ["--help"] as const;

const CLAUDE_PERMISSION_MODE_FLAG = "--permission-mode";
const CLAUDE_EFFORT_FLAG = "--effort";

const DETECTION_DETAIL = "Announced by `claude --help` from the installed binary.";

/** `default` is what an older CLI calls the mode the current one announces as `manual`. */
const ASKS_FIRST = "Claude asks before making edits.";

/**
 * One line each, in Claude's own wording, plus what only Otomat can state about
 * running the mode headless. Claude Code's help page names the modes but
 * describes none of them, so a mode neither source can describe carries no
 * description rather than an invented one.
 */
const PERMISSION_MODE_DESCRIPTIONS = new Map<string, string>([
  ["manual", ASKS_FIRST],
  ["default", ASKS_FIRST],
  ["auto", "Claude approves safe actions and pauses for risky ones."],
  [
    "acceptEdits",
    "Claude edits the selected code or file. Another gated tool still waits for an approval a headless run cannot give.",
  ],
  ["plan", "Claude explores and presents a plan before editing."],
  [
    "bypassPermissions",
    "Claude skips every permission check, like `--dangerously-skip-permissions`.",
  ],
]);

/** The one mode Claude Code itself labels dangerous: its `--dangerously-skip-permissions` twin. */
const DANGEROUS_PERMISSION_MODES = new Set(["bypassPermissions"]);

/** Most autonomous first. `bypassPermissions` is deliberately absent: removing every check stays an explicit per-run choice. */
const PERMISSION_MODE_PREFERENCE = ["auto", "acceptEdits"] as const;

const AUTONOMOUS_DEFAULT_NOTE =
  "Otomat sends `auto` when nothing else is selected, so the provider decides for itself instead of asking a question a headless run cannot answer.";

const DEGRADED_DEFAULT_NOTE =
  "This Claude Code announces no `auto` mode, so Otomat falls back to `acceptEdits`: edits apply, but a gated command such as `git commit` or `git push` is denied outright because nothing can approve it here. Update Claude Code to get the autonomous mode.";

function permissionModeChoice(value: string): ProviderOptionChoice {
  return {
    value,
    description: PERMISSION_MODE_DESCRIPTIONS.get(value) ?? null,
    dangerous: DANGEROUS_PERMISSION_MODES.has(value),
  };
}

function permissionModeDefault(values: readonly string[]): string | null {
  return PERMISSION_MODE_PREFERENCE.find((mode) => values.includes(mode)) ?? null;
}

function permissionModeDescriptor(help: string): ProviderOptionDescriptor | null {
  const values = helpFlagValues(help, CLAUDE_PERMISSION_MODE_FLAG);
  if (values === null || values.length === 0) return null;
  const fallback = permissionModeDefault(values);
  return {
    key: "permission_mode",
    description: `How Claude Code decides whether a tool call may proceed. ${fallback === "auto" ? AUTONOMOUS_DEFAULT_NOTE : DEGRADED_DEFAULT_NOTE}`,
    choices: values.map(permissionModeChoice),
    default_value: fallback,
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
export function claudeOptionSupport(binary: string): RuntimeOptionSupport {
  const probe = cachedProviderProbe(binary, CLAUDE_HELP_ARGS);
  if (probe.status !== "ok") {
    return { detection: { status: probe.status, detail: probe.detail }, options: [] };
  }
  const options = [permissionModeDescriptor(probe.stdout), effortDescriptor(probe.stdout)].filter(
    (option): option is ProviderOptionDescriptor => option !== null,
  );
  return { detection: { status: "ok", detail: DETECTION_DETAIL }, options };
}

/** Only the binary that runs the turn can say this, so it is resolved here rather than reconstructed from a plan elsewhere. */
export function claudePermissionModeStatus(
  binary: string,
  frozen: string | undefined,
): PermissionModeStatus {
  if (frozen === undefined) return "unfrozen";
  const descriptor = providerOptionDescriptor(
    claudeOptionSupport(binary).options,
    "permission_mode",
  );
  if (descriptor === null || !descriptor.choices.some((choice) => choice.value === frozen)) {
    return "unannounced";
  }
  return frozen === providerOptionDefault(descriptor) ? "autonomous" : "supervised";
}
