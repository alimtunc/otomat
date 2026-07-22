import {
  CLAUDE_PERMISSION_MODES,
  type ProviderOptionDescriptor,
  type RuntimeCapabilities,
} from "@otomat/domain";

import {
  requireProviderSession,
  runCliTurn,
  type CliTurnInput,
  type CliTurnSpec,
} from "#runtime/cli/turn";
import type { TurnRef } from "#runtime/cli/turn-emitter";
import type {
  RuntimeAdapter,
  RuntimeFinalState,
  RuntimeResumeInput,
  RuntimeRunInput,
  RuntimeSessionRef,
} from "#runtime/contract";
import type { RuntimeSink } from "#runtime/sinks";

import { ClaudeFrameMapper } from "./frames.js";

export const CLAUDE_ADAPTER_ID = "claude";

export const CLAUDE_BINARY = "claude";

const CLAUDE_PERMISSION_MODE_ENV = "OTOMAT_CLAUDE_PERMISSION_MODE";
const ENV_CLAUDE_PERMISSION_MODES = ["acceptEdits", "bypassPermissions"] as const;

/** `acceptEdits` auto-approves worktree edits while headless mode auto-denies gated tools; `bypassPermissions` is an explicit per-daemon env opt-in, never the silent default. */
const DEFAULT_CLAUDE_PERMISSION_MODE = "acceptEdits";

/** The daemon-wide fallback permission mode, used when a run's frozen config selects none. */
export function claudePermissionMode(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env[CLAUDE_PERMISSION_MODE_ENV];
  const known = ENV_CLAUDE_PERMISSION_MODES.find((mode) => mode === raw);
  return known ?? DEFAULT_CLAUDE_PERMISSION_MODE;
}

const PERMISSION_MODE_LABELS: Record<(typeof CLAUDE_PERMISSION_MODES)[number], string> = {
  default: "Default (prompt)",
  acceptEdits: "Accept edits",
  plan: "Plan mode",
  bypassPermissions: "Bypass permissions",
};

/** Claude's only tunable provider option: the `--permission-mode` the CLI already accepts. */
export const CLAUDE_PROVIDER_OPTIONS: ProviderOptionDescriptor[] = [
  {
    key: "permission_mode",
    label: "Permission mode",
    choices: CLAUDE_PERMISSION_MODES.map((mode) => ({
      value: mode,
      label: PERMISSION_MODE_LABELS[mode],
    })),
    default_value: DEFAULT_CLAUDE_PERMISSION_MODE,
  },
];

const CLAUDE_CAPABILITIES: RuntimeCapabilities = {
  stream: true,
  send_message: true,
  abort: true,
  resume: true,
  permissions: false,
  diff_hints: false,
};

function baseArgs(permissionMode: string): string[] {
  return ["-p", "--output-format", "stream-json", "--verbose", "--permission-mode", permissionMode];
}

/** The prompt is piped over stdin so size and quoting never leak into argv. */
export class ClaudeRuntimeAdapter implements RuntimeAdapter {
  readonly id = CLAUDE_ADAPTER_ID;
  readonly displayName = "Claude Code";
  readonly capabilities = CLAUDE_CAPABILITIES;
  readonly providerOptions = CLAUDE_PROVIDER_OPTIONS;

  /** The binary parameter is the test seam: tests point it at a stub replaying recorded frames. */
  constructor(private readonly binary: string = CLAUDE_BINARY) {}

  async run(
    input: RuntimeRunInput,
    sink: RuntimeSink,
    signal: AbortSignal,
  ): Promise<RuntimeFinalState> {
    return runCliTurn(this.spec(baseArgs(this.permissionMode(input)), input, input), sink, signal);
  }

  async resume(
    session: RuntimeSessionRef,
    input: RuntimeResumeInput,
    sink: RuntimeSink,
    signal: AbortSignal,
  ): Promise<RuntimeFinalState> {
    const args = [
      ...baseArgs(this.permissionMode(input)),
      "--resume",
      requireProviderSession(session),
    ];
    return runCliTurn(this.spec(args, input, session), sink, signal);
  }

  /** The frozen per-run permission mode wins; otherwise the daemon-wide env fallback. */
  private permissionMode(input: RuntimeRunInput | RuntimeResumeInput): string {
    return input.options?.permission_mode ?? claudePermissionMode();
  }

  private spec(args: string[], input: CliTurnInput, ref: TurnRef): CliTurnSpec {
    return {
      adapter: this.id,
      source: "claude",
      command: this.binary,
      args,
      prompt: input.prompt,
      cwd: input.cwd,
      ref,
      createMapper: (emitter) => new ClaudeFrameMapper(emitter),
    };
  }
}
