import type { ProviderOptionDescriptor } from "@otomat/domain";

import type { RuntimeOptionSupport } from "#runtime/contract";
import { cachedProviderProbe } from "#runtime/probe/cache";
import { helpFlagValues } from "#runtime/probe/help-flags";

import { codexBundledCatalog } from "./models.js";

const CODEX_EXEC_HELP_ARGS = ["exec", "--help"] as const;

const CODEX_SANDBOX_FLAG = "--sandbox";
const CODEX_APPROVAL_FLAG = "--ask-for-approval";

/** Codex's own default sandbox for an Otomat turn: writes confined to the worktree. */
export const CODEX_DEFAULT_SANDBOX = "workspace-write";

const HELP_DETAIL = "Announced by `codex exec --help` from the installed binary";
const CATALOG_DETAIL = "reasoning levels from its bundled model catalog";

const SANDBOX_DESCRIPTIONS: Record<string, string> = {
  "read-only": "Codex may read the worktree but not write to it.",
  "workspace-write": "Codex may write inside the working directory.",
  "danger-full-access": "Codex may read and write anywhere the daemon can, with no sandbox.",
};

/**
 * Otomat drives `codex exec` with no terminal attached, so an escalation it
 * raises cannot be answered here. Saying which policies escalate is honest;
 * claiming Otomat could reply to one would not be — that is OTO-24's work.
 */
const NON_INTERACTIVE_NOTE =
  "Codex escalates to a human for approval, and Otomat runs it non-interactively, so nothing it escalates gets approved.";

const APPROVAL_DESCRIPTIONS: Record<string, string> = {
  never: "Codex never asks; it stays inside the sandbox or fails the command.",
  untrusted: `Codex asks before anything it does not consider trusted. ${NON_INTERACTIVE_NOTE}`,
  "on-request": `Codex asks when it wants to step outside the sandbox — the escalation half of Codex's own Auto preset (\`${CODEX_DEFAULT_SANDBOX}\` + \`on-request\`). ${NON_INTERACTIVE_NOTE}`,
  "on-failure": `Codex asks after a sandboxed command fails. ${NON_INTERACTIVE_NOTE}`,
};

/** The sandbox value Codex itself names for its danger: it removes the OS-level confinement entirely. */
const DANGEROUS_SANDBOXES = new Set(["danger-full-access"]);

function sandboxDescriptor(help: string): ProviderOptionDescriptor | null {
  const values = helpFlagValues(help, CODEX_SANDBOX_FLAG);
  if (values === null || values.length === 0) return null;
  return {
    key: "sandbox",
    description: "What the OS-level sandbox lets Codex write while it runs.",
    choices: values.map((value) => ({
      value,
      description: SANDBOX_DESCRIPTIONS[value] ?? null,
      dangerous: DANGEROUS_SANDBOXES.has(value),
    })),
    // Otomat has always confined Codex to the worktree, so that is what applies with no override.
    default_value: values.includes(CODEX_DEFAULT_SANDBOX) ? CODEX_DEFAULT_SANDBOX : null,
  };
}

function approvalDescriptor(help: string): ProviderOptionDescriptor | null {
  const values = helpFlagValues(help, CODEX_APPROVAL_FLAG);
  if (values === null || values.length === 0) return null;
  return {
    key: "approval_policy",
    description: "When Codex asks a human before acting. Otomat cannot answer such a request yet.",
    choices: values.map((value) => ({
      value,
      description: APPROVAL_DESCRIPTIONS[value] ?? null,
      dangerous: false,
    })),
    // Otomat sends no `--ask-for-approval`, so the installed CLI's own default stands.
    default_value: null,
  };
}

/** Only the levels the bundled catalog attributes to this exact model; a model it does not describe gets no field rather than another model's levels. */
function reasoningEffortDescriptor(
  binary: string,
  model: string | null,
): { descriptor: ProviderOptionDescriptor | null; note: string | null } {
  if (model === null) {
    return { descriptor: null, note: "Reasoning levels follow the model, so pick one first." };
  }
  const { probe, entries } = codexBundledCatalog(binary);
  if (probe.status !== "ok") {
    return { descriptor: null, note: `Reasoning levels are unavailable: ${probe.detail}` };
  }
  const entry = entries.find((candidate) => candidate.slug === model);
  const supported = entry?.supported_reasoning_levels ?? [];
  if (supported.length === 0) {
    return {
      descriptor: null,
      note: `The bundled catalog publishes no reasoning levels for "${model}", so only the runtime default is offered.`,
    };
  }
  const fallback = entry?.default_reasoning_level ?? null;
  return {
    descriptor: {
      key: "reasoning_effort",
      description: `How much reasoning effort ${model} spends, sent as \`-c model_reasoning_effort\`.`,
      choices: supported.map((value) => ({ value, description: null, dangerous: false })),
      default_value: fallback !== null && supported.includes(fallback) ? fallback : null,
    },
    note: null,
  };
}

function detectionDetail(note: string | null): string {
  return note === null ? `${HELP_DETAIL}, ${CATALOG_DETAIL}.` : `${HELP_DETAIL}. ${note}`;
}

/**
 * Feature-detected against the installed binary. The sandbox and approval
 * policy come from `codex exec --help`; the reasoning levels come from the
 * bundled catalog and therefore depend on the selected model.
 */
export function codexOptionSupport(binary: string, model: string | null): RuntimeOptionSupport {
  const probe = cachedProviderProbe(binary, CODEX_EXEC_HELP_ARGS);
  if (probe.status !== "ok") {
    return { detection: { status: probe.status, detail: probe.detail }, options: [] };
  }
  const reasoning = reasoningEffortDescriptor(binary, model);
  const options = [
    sandboxDescriptor(probe.stdout),
    approvalDescriptor(probe.stdout),
    reasoning.descriptor,
  ].filter((option): option is ProviderOptionDescriptor => option !== null);
  return { detection: { status: "ok", detail: detectionDetail(reasoning.note) }, options };
}
