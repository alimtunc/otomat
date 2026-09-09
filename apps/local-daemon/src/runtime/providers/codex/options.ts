import type { ProviderOptionDescriptor } from "@otomat/domain";

import type { RuntimeOptionSupport } from "#runtime/contract";
import { cachedProviderProbe } from "#runtime/probe/cache";
import { helpFlagValues } from "#runtime/probe/help-flags";

import {
  CODEX_EXEC_APPROVAL_NOTE,
  codexApprovalValues,
  supportsCodexReviewer,
} from "./approval.js";
import { codexBundledCatalog } from "./models.js";
import { probeCodexSandbox, type CodexSandboxProbeResult } from "./sandbox.js";

const CODEX_EXEC_HELP_ARGS = ["exec", "--help"] as const;

const CODEX_SANDBOX_FLAG = "--sandbox";

/** The widest sandbox Otomat picks by itself: writes confined to the worktree, never the unconfined one. */
export const CODEX_DEFAULT_SANDBOX = "workspace-write";

const HELP_DETAIL = "Announced by `codex exec --help` from the installed binary";
const CATALOG_DETAIL = "reasoning levels from its bundled model catalog";

const SANDBOX_DESCRIPTIONS = new Map<string, string>([
  ["read-only", "Codex may read the worktree but not write to it."],
  ["workspace-write", "Codex may write inside the working directory."],
  ["danger-full-access", "Codex may read and write anywhere the daemon can, with no sandbox."],
]);

const NON_INTERACTIVE_NOTE =
  "Codex escalates to a human for approval, and Otomat runs it non-interactively, so nothing it escalates gets approved.";

const APPROVAL_DESCRIPTIONS = new Map<string, string>([
  ["never", "Codex never asks; it stays inside the sandbox or fails the command."],
  ["untrusted", `Codex asks before anything it does not consider trusted. ${NON_INTERACTIVE_NOTE}`],
  [
    "on-request",
    `Codex asks when it wants to step outside the sandbox — the escalation half of Codex's own Auto preset (\`${CODEX_DEFAULT_SANDBOX}\` + \`on-request\`). ${NON_INTERACTIVE_NOTE}`,
  ],
  ["on-failure", `Codex asks after a sandboxed command fails. ${NON_INTERACTIVE_NOTE}`],
]);

/** The sandbox value Codex itself names for its danger: it removes the OS-level confinement entirely. */
const DANGEROUS_SANDBOXES = new Set(["danger-full-access"]);

function sandboxDescriptor(
  help: string,
  capability: CodexSandboxProbeResult | null,
): ProviderOptionDescriptor | null {
  const values = helpFlagValues(help, CODEX_SANDBOX_FLAG);
  if (values === null || values.length === 0) return null;
  const supported =
    capability?.status === "unavailable"
      ? values.filter((value) => value === "danger-full-access")
      : values;
  if (supported.length === 0) return null;
  return {
    key: "sandbox",
    description: "What the OS-level sandbox lets Codex write while it runs.",
    choices: supported.map((value) => ({
      value,
      description: SANDBOX_DESCRIPTIONS.get(value) ?? null,
      dangerous: DANGEROUS_SANDBOXES.has(value),
    })),
    default_value: supported.includes(CODEX_DEFAULT_SANDBOX) ? CODEX_DEFAULT_SANDBOX : null,
  };
}

function reviewerDescriptor(binary: string, help: string): ProviderOptionDescriptor | null {
  if (!supportsCodexReviewer(binary, help)) return null;
  return {
    key: "approvals_reviewer",
    description:
      "Who reviews approval requests. Approve for me keeps the selected confined sandbox and uses on-request when no policy is selected. A review can deny an action; it grants no blanket approval.",
    choices: [
      {
        value: "user",
        description: "No automatic review. Otomat cannot answer human approvals through exec.",
        dangerous: false,
      },
      {
        value: "auto_review",
        description:
          "Approve for me: Codex reviews eligible requests and may approve or deny them. Requires read-only or workspace-write and on-request.",
        dangerous: false,
      },
    ],
    default_value: null,
  };
}

function approvalDescriptor(
  help: string,
  reviewerSupported: boolean,
): ProviderOptionDescriptor | null {
  const values = codexApprovalValues(help);
  if (reviewerSupported && !values.includes("on-request")) values.push("on-request");
  if (values.length === 0) return null;
  return {
    key: "approval_policy",
    description: `When Codex requests approval. On-request requires Approve for me on current exec; never sends nothing to review. ${CODEX_EXEC_APPROVAL_NOTE}`,
    choices: values.map((value) => ({
      value,
      description:
        value === "on-request" && reviewerSupported
          ? "Codex requests approval when needed. Select Approve for me to route it to automatic review in exec."
          : (APPROVAL_DESCRIPTIONS.get(value) ?? null),
      dangerous: false,
    })),
    default_value: null,
  };
}

/** Only the levels the bundled catalog attributes to this exact model; a model it does not describe gets no field rather than another model's levels. */
interface ReasoningEffortField {
  descriptor: ProviderOptionDescriptor | null;
  note: string | null;
}

function reasoningEffortDescriptor(binary: string, model: string | null): ReasoningEffortField {
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
  const declared = entry?.default_reasoning_level ?? null;
  const fallback =
    declared !== null && supported.some((level) => level.effort === declared) ? declared : null;
  return {
    descriptor: {
      key: "reasoning_effort",
      description: `How much reasoning effort ${model} spends, sent as \`-c model_reasoning_effort\`.${fallback === null ? "" : ` Selecting nothing sends no override, and Codex applies "${fallback}" itself.`}`,
      choices: supported.map((level) => ({
        value: level.effort,
        description: level.description,
        dangerous: false,
      })),
      default_value: null,
    },
    note: null,
  };
}

function detectionDetail(note: string | null, capability: CodexSandboxProbeResult | null): string {
  const catalog = `${note === null ? `${HELP_DETAIL}, ${CATALOG_DETAIL}.` : `${HELP_DETAIL}. ${note}`} ${CODEX_EXEC_APPROVAL_NOTE}`;
  if (capability?.status !== "unavailable") return catalog;
  const { diagnostics } = capability;
  return `${catalog} Confined sandboxes are unavailable on host "${diagnostics.host}": ${diagnostics.stderr || capability.cause}. ${capability.remediation}`;
}

export function codexOptionSupport(binary: string, model: string | null): RuntimeOptionSupport {
  const probe = cachedProviderProbe(binary, CODEX_EXEC_HELP_ARGS);
  if (probe.status !== "ok") {
    return { detection: { status: probe.status, detail: probe.detail }, options: [] };
  }
  const capability = process.platform === "linux" ? probeCodexSandbox(binary, process.cwd()) : null;
  const reasoning = reasoningEffortDescriptor(binary, model);
  const reviewer = reviewerDescriptor(binary, probe.stdout);
  const options = [
    sandboxDescriptor(probe.stdout, capability),
    approvalDescriptor(probe.stdout, reviewer !== null),
    reviewer,
    reasoning.descriptor,
  ].filter((option): option is ProviderOptionDescriptor => option !== null);
  return {
    detection: {
      status: "ok",
      detail: `${detectionDetail(reasoning.note, capability)}${reviewer === null ? " Approve for me was not detected from exec help or the installed reviewer feature. Update the CLI on the execution host and refresh its options to detect support." : ""}`,
    },
    options,
  };
}
