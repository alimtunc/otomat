import type { ProviderOptions, RuntimeCapabilities } from "@otomat/domain";

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
  RuntimeOneShot,
  RuntimeOptionSupport,
  RuntimeResumeInput,
  RuntimeRunInput,
  RuntimeSessionRef,
} from "#runtime/contract";
import type { RuntimeModelSupport } from "#runtime/models/support";
import type { RuntimeSink } from "#runtime/sinks";

import { CodexFrameMapper } from "./frames.js";
import { codexModelSupport } from "./models.js";
import { CODEX_DEFAULT_SANDBOX, codexOptionSupport } from "./options.js";

export const CODEX_ADAPTER_ID = "codex";

export const CODEX_BINARY = "codex";

/** `provider_limit` stops at `detects`: Codex reports an exhausted quota as a turn error and never says when it reopens. */
const CODEX_CAPABILITIES: RuntimeCapabilities = {
  stream: true,
  steering: "turn_boundary",
  abort: true,
  resume: true,
  permissions: false,
  diff_hints: false,
  provider_limit: "detects",
};

/** The official config override for the reasoning level; the TOML string keeps the value a value, never a flag. */
function reasoningEffortOverride(level: string): string[] {
  return ["-c", `model_reasoning_effort="${level}"`];
}

/** The prompt is piped over stdin (`-`) so size and quoting never leak into argv. */
export class CodexRuntimeAdapter implements RuntimeAdapter {
  readonly id = CODEX_ADAPTER_ID;
  readonly displayName = "Codex CLI";
  readonly capabilities = CODEX_CAPABILITIES;

  /** The binary parameter is the test seam: tests point it at a stub replaying recorded frames. */
  constructor(private readonly binary: string = CODEX_BINARY) {}

  get models(): RuntimeModelSupport {
    return codexModelSupport(this.binary);
  }

  /** The bundled catalog publishes reasoning levels per model, so the selection changes what may be offered. */
  describeOptions(model: string | null): RuntimeOptionSupport {
    return codexOptionSupport(this.binary, model);
  }

  describeOneShot(model: string | null, options: ProviderOptions): RuntimeOneShot {
    return {
      command: this.binary,
      args: ["exec", "--sandbox", "read-only", ...this.tuningArgs(model, options), "-"],
      effort: options.reasoning_effort ?? null,
    };
  }

  async run(
    input: RuntimeRunInput,
    sink: RuntimeSink,
    signal: AbortSignal,
  ): Promise<RuntimeFinalState> {
    const args = ["exec", ...this.execArgs(input), "-"];
    return runCliTurn(this.spec(args, input, input), sink, signal);
  }

  async resume(
    session: RuntimeSessionRef,
    input: RuntimeResumeInput,
    sink: RuntimeSink,
    signal: AbortSignal,
  ): Promise<RuntimeFinalState> {
    // Every configured flag is `exec`-level; the real CLI rejects them after the `resume` subcommand.
    const args = ["exec", ...this.execArgs(input), "resume", requireProviderSession(session), "-"];
    return runCliTurn(this.spec(args, input, session), sink, signal);
  }

  /** JSONL output plus the frozen sandbox, approval policy, reasoning level and model, in that order. */
  private execArgs(input: RuntimeRunInput | RuntimeResumeInput): string[] {
    const options = input.options ?? {};
    const args = ["--json", "--sandbox", options.sandbox ?? CODEX_DEFAULT_SANDBOX];
    if (options.approval_policy !== undefined) {
      args.push("--ask-for-approval", options.approval_policy);
    }
    return [...args, ...this.tuningArgs(input.model ?? null, options)];
  }

  private tuningArgs(model: string | null, options: ProviderOptions): string[] {
    const args: string[] = [];
    if (options.reasoning_effort !== undefined) {
      args.push(...reasoningEffortOverride(options.reasoning_effort));
    }
    if (model !== null) args.push("--model", model);
    return args;
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
