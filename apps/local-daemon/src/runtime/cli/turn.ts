import { existsSync } from "node:fs";

import type { ProviderLimit } from "@otomat/domain";

import type { RuntimeFinalState, RuntimeRunInput, RuntimeUsage } from "#runtime/contract";
import { errorMessage } from "#runtime/errors";
import type { RuntimeEvent } from "#runtime/events";
import type { RuntimeSink } from "#runtime/sinks";

import { parseJsonRecord } from "./frame-guards.js";
import { runCliProcess, type CliProcessExit, type CliProcessOptions } from "./process-runner.js";
import { TurnEmitter, type TurnRef } from "./turn-emitter.js";

/**
 * A quota a frame mapper recognised in its provider's own output; `runCliTurn`
 * stamps which provider said it. A mapper that reports one also emits a
 * `runtime.provider_limit` event carrying the raw frame, so the wait it ends up
 * scheduling stays auditable against what the CLI actually said.
 */
export type ProviderLimitReport = Omit<ProviderLimit, "provider">;

/** Provider evidence a frame mapper accumulates over one turn; null fields mean the provider never reported them. */
export interface ProviderTurnOutcome {
  providerSessionId: string | null;
  usage: RuntimeUsage | null;
  result: { isError: boolean; message: string | null } | null;
  limit: ProviderLimitReport | null;
}

/** Maps one provider-native stdout frame onto runtime events while accumulating the turn outcome. */
export interface ProviderFrameMapper {
  readonly outcome: ProviderTurnOutcome;
  onFrame(frame: Record<string, unknown>): void;
}

export interface CliTurnSpec {
  /** Adapter id, stamped on payloads and used in error messages. */
  adapter: string;
  source: RuntimeEvent["source"];
  command: string;
  args: string[];
  prompt: string;
  cwd: string;
  ref: TurnRef;
  streamStdin?: CliProcessOptions["streamStdin"];
  createMapper(emitter: TurnEmitter): ProviderFrameMapper;
}

/** The prompt/cwd subset of the run/resume inputs a CLI adapter forwards into its spec. */
export type CliTurnInput = Pick<RuntimeRunInput, "prompt" | "cwd">;

/** Guards the resume precondition shared by every CLI adapter. */
export function requireProviderSession(session: {
  run_id: string;
  provider_session_id: string | null;
}): string {
  if (session.provider_session_id === null) {
    throw new Error(`run ${session.run_id} has no provider session to resume`);
  }
  return session.provider_session_id;
}

/** Shared CLI turn lifecycle: worktree existence guard (a real provider never falls back to another directory), line-parsed stdout through the mapper, honest final state — the provider's own result wins even over an abort race, never a fake success. */
export async function runCliTurn(
  spec: CliTurnSpec,
  sink: RuntimeSink,
  signal: AbortSignal,
): Promise<RuntimeFinalState> {
  const emitter = new TurnEmitter(sink, spec.adapter, spec.source, spec.ref);
  const mapper = spec.createMapper(emitter);

  if (!existsSync(spec.cwd)) {
    const message = `worktree ${spec.cwd} does not exist`;
    emitter.daemonLog(message);
    return failedState(spec.adapter, message, mapper.outcome, emitter.emitted);
  }
  const workDir = spec.cwd;

  // Line handlers run outside this try/catch (readline events); a mapper/sink throw is captured so the turn still resolves a failed state instead of tearing the worker.
  let dispatchError: string | null = null;
  const dispatchAbort = new AbortController();
  const guarded = (dispatch: () => void): void => {
    try {
      dispatch();
    } catch (error) {
      dispatchError ??= `event dispatch failed: ${errorMessage(error)}`;
      dispatchAbort.abort();
    }
  };
  const pump = spec.streamStdin;
  const guardedPump: CliProcessOptions["streamStdin"] =
    pump &&
    (async (write, inputSignal) => {
      try {
        await pump(write, inputSignal);
      } catch (error) {
        dispatchError ??= `live input failed: ${errorMessage(error)}`;
        dispatchAbort.abort();
      }
    });

  try {
    const exit = await runCliProcess({
      command: spec.command,
      args: spec.args,
      cwd: workDir,
      stdin: spec.prompt,
      streamStdin: guardedPump,
      signal: AbortSignal.any([signal, dispatchAbort.signal]),
      onStdoutLine: (line) => guarded(() => dispatchStdoutLine(line, emitter, mapper)),
      onStderrLine: (line) => guarded(() => emitter.log("stderr", line)),
    });
    if (dispatchError !== null) {
      return failedState(spec.adapter, dispatchError, mapper.outcome, emitter.emitted);
    }
    return finalStateFromExit(spec.adapter, exit, mapper.outcome, emitter);
  } catch (error) {
    const message = `failed to run ${spec.adapter}: ${errorMessage(error)}`;
    emitter.daemonLog(message);
    return failedState(spec.adapter, message, mapper.outcome, emitter.emitted);
  }
}

function finalStateFromExit(
  adapter: string,
  exit: CliProcessExit,
  outcome: ProviderTurnOutcome,
  emitter: TurnEmitter,
): RuntimeFinalState {
  if (outcome.result !== null) {
    return {
      status: outcome.result.isError ? "failed" : "completed",
      provider_session_id: outcome.providerSessionId,
      usage: outcome.usage,
      error: outcome.result.isError
        ? { message: outcome.result.message ?? "provider reported an error" }
        : null,
      limit: outcome.result.isError ? providerLimit(adapter, outcome) : null,
      event_count: emitter.emitted,
    };
  }
  if (exit.aborted) {
    return {
      status: "canceled",
      provider_session_id: outcome.providerSessionId,
      usage: outcome.usage,
      error: null,
      limit: null,
      event_count: emitter.emitted,
    };
  }
  const message = `${adapter} exited (${exit.signal ?? exit.code ?? "unknown"}) without reporting a result`;
  emitter.daemonLog(message);
  return failedState(adapter, message, outcome, emitter.emitted);
}

function providerLimit(adapter: string, outcome: ProviderTurnOutcome): ProviderLimit | null {
  return outcome.limit === null ? null : { provider: adapter, ...outcome.limit };
}

function dispatchStdoutLine(line: string, emitter: TurnEmitter, mapper: ProviderFrameMapper): void {
  if (line.trim().length === 0) return;
  const frame = parseJsonRecord(line);
  if (frame === null) {
    emitter.log("stdout", line);
    return;
  }
  mapper.onFrame(frame);
}

function failedState(
  adapter: string,
  message: string,
  outcome: ProviderTurnOutcome,
  eventCount: number,
): RuntimeFinalState {
  return {
    status: "failed",
    provider_session_id: outcome.providerSessionId,
    usage: outcome.usage,
    error: { message },
    limit: providerLimit(adapter, outcome),
    event_count: eventCount,
  };
}
