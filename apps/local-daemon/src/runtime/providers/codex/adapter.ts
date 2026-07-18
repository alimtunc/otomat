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

import { CodexFrameMapper } from "./frames.js";

export const CODEX_ADAPTER_ID = "codex";

export const CODEX_BINARY = "codex";

const CODEX_CAPABILITIES: RuntimeCapabilities = {
  stream: true,
  send_message: true,
  abort: true,
  resume: true,
  permissions: false,
  diff_hints: false,
};

/** JSONL output plus the OS-level sandbox confining writes to the working directory. */
const BASE_EXEC_ARGS = ["--json", "--sandbox", "workspace-write"];

/** The prompt is piped over stdin (`-`) so size and quoting never leak into argv. */
export class CodexRuntimeAdapter implements RuntimeAdapter {
  readonly id = CODEX_ADAPTER_ID;
  readonly displayName = "Codex CLI";
  readonly capabilities = CODEX_CAPABILITIES;

  /** The binary parameter is the test seam: tests point it at a stub replaying recorded frames. */
  constructor(private readonly binary: string = CODEX_BINARY) {}

  async run(
    input: RuntimeRunInput,
    sink: RuntimeSink,
    signal: AbortSignal,
  ): Promise<RuntimeFinalState> {
    const args = ["exec", ...BASE_EXEC_ARGS, "-"];
    return runCliTurn(this.spec(args, input, input), sink, signal);
  }

  async resume(
    session: RuntimeSessionRef,
    input: RuntimeResumeInput,
    sink: RuntimeSink,
    signal: AbortSignal,
  ): Promise<RuntimeFinalState> {
    // `--json`/`--sandbox` are `exec`-level flags; the real CLI rejects them after the `resume` subcommand.
    const args = ["exec", ...BASE_EXEC_ARGS, "resume", requireProviderSession(session), "-"];
    return runCliTurn(this.spec(args, input, session), sink, signal);
  }

  private spec(args: string[], input: CliTurnInput, ref: TurnRef): CliTurnSpec {
    return {
      adapter: this.id,
      source: "codex",
      command: this.binary,
      args,
      prompt: input.prompt,
      cwd: input.cwd,
      ref,
      createMapper: (emitter) => new CodexFrameMapper(emitter),
    };
  }
}
