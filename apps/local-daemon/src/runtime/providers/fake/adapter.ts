import { randomUUID } from "node:crypto";
import { appendFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  type RuntimeAdapter,
  type RuntimeAdapterCapabilities,
  type RuntimeFinalState,
  type RuntimeOptionSupport,
  type RuntimeResumeInput,
  type RuntimeRunInput,
  type RuntimeSessionRef,
} from "#runtime/contract";
import type { RuntimeSink } from "#runtime/sinks";

import { FAKE_MODEL_SUPPORT } from "./models.js";
import { fakeOptionSupport } from "./options.js";
import {
  buildEvent,
  canceledState,
  FAKE_ADAPTER_ID,
  providerSessionId,
  type TurnContext,
} from "./turn-events.js";
import { abortSpec, FAKE_USAGE, resumeSpecs, runSpecs, type EventSpec } from "./turn-specs.js";

export { FAKE_ADAPTER_ID } from "./turn-events.js";

const SIMULATED_WORK_FILENAME = "simulated-turn.md";

function configuredBarrierPath(): string | null {
  return process.env.OTOMAT_FAKE_RUNTIME_BARRIER_PATH || null;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** The simulated turn leaves real edits in its `cwd` worktree so the canonical git diff has honest content to show. */
function writeSimulatedWork(cwd: string, prompt: string, followUp: boolean): void {
  if (!existsSync(cwd)) return;
  const file = join(cwd, SIMULATED_WORK_FILENAME);
  if (followUp && existsSync(file)) {
    appendFileSync(file, `\n## Follow-up turn\n\n${prompt}\n`);
    return;
  }
  writeFileSync(
    file,
    `# Simulated turn\n\nNo model was contacted, so this file records the prompt instead of implementing it.\n\n## Prompt\n\n${prompt}\n`,
  );
}

/**
 * Test adapter with collision-resistant ids and deterministic payloads; each event is stamped from
 * the injected clock (`Date.now` by default) at emission. Exercises the full
 * sink pipeline — provider session, logs, tool calls, permission round-trip,
 * usage — across all three fidelity tiers. Durability is the caller's sink concern, as with a real
 * provider adapter. Every event is labeled `test_adapter` with
 * `source: "otomat"`, so no frame can ever be presented as a real provider result.
 */
export class FakeRuntimeAdapter implements RuntimeAdapter {
  readonly id = FAKE_ADAPTER_ID;
  readonly displayName = "Simulation";
  readonly capabilities: RuntimeAdapterCapabilities = {
    stream: true,
    steering: "turn_boundary",
    abort: true,
    resume: true,
    interactions: {
      status: "unsupported",
      reason: "The simulated runtime decides its own turn; it never asks the operator anything.",
    },
    diff_hints: false,
    provider_limit: "unsupported",
  };
  readonly models = FAKE_MODEL_SUPPORT;

  /** Monotonic per-instance turn counter: keeps event ids unique across run/resume turns. */
  private turn = 0;
  private readonly instanceId: string;

  constructor(
    private readonly clock: () => number = Date.now,
    private readonly barrierPath = configuredBarrierPath(),
    instanceId: string = randomUUID(),
  ) {
    this.instanceId = instanceId;
  }

  /** Simulated, but model-scoped like the real providers, so the effort path is exercised without a CLI. */
  describeOptions(model: string | null): RuntimeOptionSupport {
    return fakeOptionSupport(model);
  }

  async run(
    input: RuntimeRunInput,
    sink: RuntimeSink,
    signal: AbortSignal,
  ): Promise<RuntimeFinalState> {
    writeSimulatedWork(input.cwd, input.prompt, false);
    const providerSession = providerSessionId(input.agent_session_id);
    const ctx: TurnContext = {
      run_id: input.run_id,
      step_run_id: input.step_run_id,
      agent_session_id: input.agent_session_id,
      provider_session_id: providerSession,
    };
    return this.emitTurn(ctx, runSpecs(input.prompt, providerSession), sink, signal);
  }

  async resume(
    session: RuntimeSessionRef,
    input: RuntimeResumeInput,
    sink: RuntimeSink,
    signal: AbortSignal,
  ): Promise<RuntimeFinalState> {
    writeSimulatedWork(input.cwd, input.prompt, true);
    const providerSession =
      session.provider_session_id ?? providerSessionId(session.agent_session_id);
    const ctx: TurnContext = {
      run_id: session.run_id,
      step_run_id: session.step_run_id,
      agent_session_id: session.agent_session_id,
      provider_session_id: providerSession,
    };
    return this.emitTurn(ctx, resumeSpecs(input.prompt, providerSession), sink, signal);
  }

  async abort(_session: RuntimeSessionRef, _reason: string): Promise<void> {
    // Out-of-band abort is observed through the AbortSignal passed to run/resume.
  }

  private async emitTurn(
    ctx: TurnContext,
    specs: EventSpec[],
    sink: RuntimeSink,
    signal: AbortSignal,
  ): Promise<RuntimeFinalState> {
    const turn = this.turn++;
    let emitted = 0;
    for (const spec of specs) {
      if (signal.aborted) {
        sink.emit(buildEvent(ctx, turn, emitted, abortSpec(), this.clock(), this.instanceId));
        emitted += 1;
        return canceledState(ctx.provider_session_id, emitted);
      }
      sink.emit(buildEvent(ctx, turn, emitted, spec, this.clock(), this.instanceId));
      emitted += 1;
      if (emitted === 1 && this.barrierPath) {
        while (!signal.aborted && !existsSync(this.barrierPath)) await delay(10);
      }
    }
    return {
      status: "completed",
      provider_session_id: ctx.provider_session_id,
      usage: FAKE_USAGE,
      error: null,
      limit: null,
      event_count: emitted,
    };
  }
}
