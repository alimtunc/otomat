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
  RuntimeResumeInput,
  RuntimeRunInput,
  RuntimeSessionRef,
} from "#runtime/contract";
import type { RuntimeSink } from "#runtime/sinks";

import { ClaudeFrameMapper } from "./frames.js";

export const CLAUDE_ADAPTER_ID = "claude";

const CLAUDE_PERMISSION_MODE_ENV = "OTOMAT_CLAUDE_PERMISSION_MODE";
const CLAUDE_PERMISSION_MODES = ["acceptEdits", "bypassPermissions"] as const;
type ClaudePermissionMode = (typeof CLAUDE_PERMISSION_MODES)[number];

/** `acceptEdits` auto-approves worktree edits while headless mode auto-denies gated tools; `bypassPermissions` is an explicit per-daemon env opt-in, never the silent default. */
const DEFAULT_CLAUDE_PERMISSION_MODE: ClaudePermissionMode = "acceptEdits";

export function claudePermissionMode(env: NodeJS.ProcessEnv = process.env): ClaudePermissionMode {
  const raw = env[CLAUDE_PERMISSION_MODE_ENV];
  const known = CLAUDE_PERMISSION_MODES.find((mode) => mode === raw);
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

function baseArgs(): string[] {
  return [
    "-p",
    "--output-format",
    "stream-json",
    "--verbose",
    "--permission-mode",
    claudePermissionMode(),
  ];
}

/** The prompt is piped over stdin so size and quoting never leak into argv. */
export class ClaudeRuntimeAdapter implements RuntimeAdapter {
  readonly id = CLAUDE_ADAPTER_ID;
  readonly displayName = "Claude Code";
  readonly capabilities = CLAUDE_CAPABILITIES;

  /** The binary parameter is the test seam: tests point it at a stub replaying recorded frames. */
  constructor(private readonly binary = "claude") {}

  async run(
    input: RuntimeRunInput,
    sink: RuntimeSink,
    signal: AbortSignal,
  ): Promise<RuntimeFinalState> {
    return runCliTurn(this.spec(baseArgs(), input, input), sink, signal);
  }

  async resume(
    session: RuntimeSessionRef,
    input: RuntimeResumeInput,
    sink: RuntimeSink,
    signal: AbortSignal,
  ): Promise<RuntimeFinalState> {
    const args = [...baseArgs(), "--resume", requireProviderSession(session)];
    return runCliTurn(this.spec(args, input, session), sink, signal);
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
