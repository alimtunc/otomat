import type { ProviderOptions, RuntimeCapabilities } from "@otomat/domain";

import { requireProviderSession, runCliTurn, type CliTurnSpec } from "#runtime/cli/turn";
import type { TurnRef } from "#runtime/cli/turn-emitter";
import type {
  LiveInputChannel,
  RuntimeAdapter,
  RuntimeFinalState,
  RuntimeOneShot,
  RuntimeOptionSupport,
  RuntimeResumeInput,
  RuntimeRunInput,
  RuntimeSessionRef,
} from "#runtime/contract";
import type { RuntimeSink } from "#runtime/sinks";

import { ClaudeFrameMapper } from "./frames.js";
import { ClaudeLiveInput, claudeUserFrame } from "./live-input.js";
import { CLAUDE_MODEL_SUPPORT } from "./models.js";
import { claudeOptionSupport, claudePermissionModeStatus } from "./options.js";

export const CLAUDE_ADAPTER_ID = "claude";

export const CLAUDE_BINARY = "claude";

const CLAUDE_PERMISSION_MODE_ENV = "OTOMAT_CLAUDE_PERMISSION_MODE";
const ENV_CLAUDE_PERMISSION_MODES = ["acceptEdits", "bypassPermissions"] as const;

/** What a plan frozen before Otomat froze the mode ran under; `bypassPermissions` is an explicit per-daemon env opt-in, never the silent default. */
const DEFAULT_CLAUDE_PERMISSION_MODE = "acceptEdits";

/** Only a config frozen without a mode reaches this: a current launch resolves the announced default and freezes it. */
export function claudePermissionMode(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env[CLAUDE_PERMISSION_MODE_ENV];
  const known = ENV_CLAUDE_PERMISSION_MODES.find((mode) => mode === raw);
  return known ?? DEFAULT_CLAUDE_PERMISSION_MODE;
}

/**
 * `steering` is `live` because the CLI reads further user messages from an open
 * stdin while it works. `permissions` stays false: `claude -p` reports the calls
 * it refused but exposes no channel to answer one. `provider_limit` is `deadline`
 * because the CLI prints the unix second its plan window reopens next to the
 * limit it reports.
 */
const CLAUDE_CAPABILITIES: RuntimeCapabilities = {
  stream: true,
  steering: "live",
  abort: true,
  resume: true,
  permissions: false,
  diff_hints: false,
  provider_limit: "deadline",
};

type TurnInput = RuntimeRunInput | RuntimeResumeInput;

/** The prompt is piped over stdin as a streaming-input user frame, so size and quoting never leak into argv and a live message can follow it on the same pipe. */
export class ClaudeRuntimeAdapter implements RuntimeAdapter {
  readonly id = CLAUDE_ADAPTER_ID;
  readonly displayName = "Claude Code";
  readonly capabilities = CLAUDE_CAPABILITIES;
  readonly models = CLAUDE_MODEL_SUPPORT;

  /** The binary parameter is the test seam: tests point it at a stub replaying recorded frames. */
  constructor(private readonly binary: string = CLAUDE_BINARY) {}

  /** Claude Code's options do not vary by model, so the selection is not consulted. */
  describeOptions(_model: string | null): RuntimeOptionSupport {
    return claudeOptionSupport(this.binary);
  }

  /** No permission mode is sent: `-p` then refuses every write the model attempts, which is what a read-only question wants. */
  describeOneShot(model: string | null, options: ProviderOptions): RuntimeOneShot {
    return {
      command: this.binary,
      args: ["-p", "--output-format", "text", ...this.tuningArgs(model, options)],
      effort: options.effort ?? null,
    };
  }

  async run(
    input: RuntimeRunInput,
    sink: RuntimeSink,
    signal: AbortSignal,
    live?: LiveInputChannel,
  ): Promise<RuntimeFinalState> {
    return runCliTurn(this.spec(input, input, [], live), sink, signal);
  }

  async resume(
    session: RuntimeSessionRef,
    input: RuntimeResumeInput,
    sink: RuntimeSink,
    signal: AbortSignal,
    live?: LiveInputChannel,
  ): Promise<RuntimeFinalState> {
    const sessionArgs = ["--resume", requireProviderSession(session)];
    return runCliTurn(this.spec(input, session, sessionArgs, live), sink, signal);
  }

  /**
   * The permission mode is always sent: a CLI that stopped accepting the daemon
   * fallback must fail loudly rather than have Otomat quietly hand the turn a
   * different permission boundary.
   */
  private turnArgs(input: TurnInput, mode: string): string[] {
    return [
      "-p",
      "--input-format",
      "stream-json",
      "--output-format",
      "stream-json",
      "--verbose",
      "--permission-mode",
      mode,
      ...this.tuningArgs(input.model ?? null, input.options ?? {}),
    ];
  }

  private tuningArgs(model: string | null, options: ProviderOptions): string[] {
    const args: string[] = [];
    if (options.effort !== undefined) args.push("--effort", options.effort);
    if (model !== null) args.push("--model", model);
    return args;
  }

  /** Session flags come last so `--resume <id>` closes the argv, the order Claude Code expects. */
  private spec(
    input: TurnInput,
    ref: TurnRef,
    sessionArgs: string[],
    live: LiveInputChannel | undefined,
  ): CliTurnSpec {
    const frozen = input.options?.permission_mode;
    const permission = {
      mode: frozen ?? claudePermissionMode(),
      status: claudePermissionModeStatus(this.binary, frozen),
    };
    const liveInput = live && new ClaudeLiveInput(live);
    return {
      adapter: this.id,
      source: "claude",
      command: this.binary,
      args: [...this.turnArgs(input, permission.mode), ...sessionArgs],
      prompt: claudeUserFrame(input.prompt),
      cwd: input.cwd,
      ref,
      streamStdin: liveInput?.stream,
      createMapper: (emitter) => new ClaudeFrameMapper(emitter, permission, liveInput?.onResult),
    };
  }
}
