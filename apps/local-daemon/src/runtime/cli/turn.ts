import { existsSync } from "node:fs";

import type { RuntimeFinalState, RuntimeRunInput, RuntimeUsage } from "#runtime/contract";
import type { RuntimeEvent } from "#runtime/events";
import type { RuntimeSink } from "#runtime/sinks";

import { parseJsonRecord } from "./frame-guards.js";
import { runCliProcess, type CliProcessExit } from "./process-runner.js";
import { TurnEmitter, type TurnRef } from "./turn-emitter.js";

/** Provider evidence a frame mapper accumulates over one turn; null fields mean the provider never reported them. */
export interface ProviderTurnOutcome {
  providerSessionId: string | null;
  usage: RuntimeUsage | null;
  result: { isError: boolean; message: string | null } | null;
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
  cwd: string | null | undefined;
  ref: TurnRef;
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

/** Shared CLI turn lifecycle: worktree guard (a real provider never falls back to another directory), line-parsed stdout through the mapper, honest final state — the provider's own result wins even over an abort race, never a fake success. */
export async function runCliTurn(
  spec: CliTurnSpec,
  sink: RuntimeSink,
  signal: AbortSignal,
): Promise<RuntimeFinalState> {
  const emitter = new TurnEmitter(sink, spec.adapter, spec.source, spec.ref);
  const mapper = spec.createMapper(emitter);

  if (!spec.cwd || !existsSync(spec.cwd)) {
    const message = spec.cwd
      ? `worktree ${spec.cwd} does not exist`
      : "a real runtime requires the run's worktree and none was provided";
    emitter.daemonLog(message);
    return failedState(message, mapper.outcome, emitter.emitted);
  }
  const workDir = spec.cwd;

  // Line handlers run outside this try/catch (readline events); a mapper/sink throw is captured so the turn still resolves a failed state instead of tearing the worker.
  let dispatchError: string | null = null;
  const dispatchAbort = new AbortController();
  const guarded = (dispatch: () => void): void => {
    try {
      dispatch();
    } catch (error) {
      dispatchError ??= error instanceof Error ? error.message : String(error);
      // The evidence pipeline is dead from the first throw; kill the child instead of letting it work on unrecorded.
      dispatchAbort.abort();
    }
  };

  try {
    const exit = await runCliProcess({
      command: spec.command,
      args: spec.args,
      cwd: workDir,
      stdin: spec.prompt,
      signal: AbortSignal.any([signal, dispatchAbort.signal]),
      onStdoutLine: (line) => guarded(() => dispatchStdoutLine(line, emitter, mapper)),
      onStderrLine: (line) => guarded(() => emitter.log("stderr", line)),
    });
    if (dispatchError !== null) {
      return failedState(
        `event dispatch failed: ${dispatchError}`,
        mapper.outcome,
        emitter.emitted,
      );
    }
    return finalStateFromExit(spec.adapter, exit, mapper.outcome, emitter);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    emitter.daemonLog(`failed to run ${spec.adapter}: ${message}`);
    return failedState(
      `failed to run ${spec.adapter}: ${message}`,
      mapper.outcome,
      emitter.emitted,
    );
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
      event_count: emitter.emitted,
    };
  }
  if (exit.aborted) {
    return {
      status: "canceled",
      provider_session_id: outcome.providerSessionId,
      usage: outcome.usage,
      error: null,
      event_count: emitter.emitted,
    };
  }
  // The process ended without a result frame: log the daemon's verdict so the failure is legible in the ledger, not just a bare `failed` status.
  const message = `${adapter} exited (${exit.signal ?? exit.code ?? "unknown"}) without reporting a result`;
  emitter.daemonLog(message);
  return failedState(message, outcome, emitter.emitted);
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
  message: string,
  outcome: ProviderTurnOutcome,
  eventCount: number,
): RuntimeFinalState {
  return {
    status: "failed",
    provider_session_id: outcome.providerSessionId,
    usage: outcome.usage,
    error: { message },
    event_count: eventCount,
  };
}
