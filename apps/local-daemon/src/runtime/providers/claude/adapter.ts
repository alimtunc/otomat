import type { RuntimeCapabilities } from "@otomat/domain";

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
  RuntimeOptionSupport,
  RuntimeResumeInput,
  RuntimeRunInput,
  RuntimeSessionRef,
} from "#runtime/contract";
import type { RuntimeSink } from "#runtime/sinks";

import { ClaudeFrameMapper } from "./frames.js";
import { CLAUDE_MODEL_SUPPORT } from "./models.js";
import { claudeOptionSupport } from "./options.js";

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

const CLAUDE_CAPABILITIES: RuntimeCapabilities = {
  stream: true,
  send_message: true,
  abort: true,
  resume: true,
  permissions: false,
  diff_hints: false,
};

/** The prompt is piped over stdin so size and quoting never leak into argv. */
export class ClaudeRuntimeAdapter implements RuntimeAdapter {
  readonly id = CLAUDE_ADAPTER_ID;
  readonly displayName = "Claude Code";
  readonly capabilities = CLAUDE_CAPABILITIES;
  readonly models = CLAUDE_MODEL_SUPPORT;

  /** The binary parameter is the test seam: tests point it at a stub replaying recorded frames. */
  constructor(private readonly binary: string = CLAUDE_BINARY) {}

  /** Claude Code's options do not vary by model, so the selection is not consulted. */
  describeOptions(_model: string | null): RuntimeOptionSupport {
    return claudeOptionSupport(this.binary, claudePermissionMode());
  }

  async run(
    input: RuntimeRunInput,
    sink: RuntimeSink,
    signal: AbortSignal,
  ): Promise<RuntimeFinalState> {
    return runCliTurn(this.spec(this.turnArgs(input), input, input), sink, signal);
  }

  async resume(
    session: RuntimeSessionRef,
    input: RuntimeResumeInput,
    sink: RuntimeSink,
    signal: AbortSignal,
  ): Promise<RuntimeFinalState> {
    const args = [...this.turnArgs(input), "--resume", requireProviderSession(session)];
    return runCliTurn(this.spec(args, input, session), sink, signal);
  }

  /**
   * Session flags come last so `--resume <id>` closes the argv on a resume, the
   * order Claude Code expects. The permission mode is always sent: a CLI that
   * stopped accepting the daemon fallback must fail loudly rather than have
   * Otomat quietly hand the turn a different permission boundary.
   */
  private turnArgs(input: RuntimeRunInput | RuntimeResumeInput): string[] {
    const options = input.options ?? {};
    const args = [
      "-p",
      "--output-format",
      "stream-json",
      "--verbose",
      "--permission-mode",
      options.permission_mode ?? claudePermissionMode(),
    ];
    if (options.effort !== undefined) args.push("--effort", options.effort);
    if (input.model != null) args.push("--model", input.model);
    return args;
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
