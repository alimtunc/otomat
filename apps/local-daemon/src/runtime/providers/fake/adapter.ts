import { randomUUID } from "node:crypto";
import { appendFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { FAKE_RUNTIME_ID, type RuntimeCapabilities } from "@otomat/domain";

import {
  type RuntimeAdapter,
  type RuntimeFinalState,
  type RuntimeResumeInput,
  type RuntimeRunInput,
  type RuntimeSessionRef,
  type RuntimeUsage,
} from "#runtime/contract";
import type { EventFidelity, RuntimeEvent } from "#runtime/events";
import type { RuntimeSink } from "#runtime/sinks";

export const FAKE_ADAPTER_ID = FAKE_RUNTIME_ID;

const FAKE_WORK_FILENAME = "fake-implementation.md";

function configuredBarrierPath(env: NodeJS.ProcessEnv = process.env): string | null {
  return env.OTOMAT_FAKE_RUNTIME_BARRIER_PATH || null;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** The fake turn leaves real edits in its `cwd` worktree so the canonical git diff has honest content to show. */
function writeFakeWork(cwd: string | null | undefined, prompt: string, followUp: boolean): void {
  if (!cwd || !existsSync(cwd)) return;
  const file = join(cwd, FAKE_WORK_FILENAME);
  if (followUp && existsSync(file)) {
    appendFileSync(file, `\n## Follow-up turn\n\n${prompt}\n`);
    return;
  }
  writeFileSync(file, `# Fake implementation\n\n## Prompt\n\n${prompt}\n`);
}

const FAKE_USAGE: RuntimeUsage = {
  model: "fake-model-v1",
  input_tokens: 128,
  output_tokens: 64,
  total_tokens: 192,
  cost_usd: 0,
};

interface EventSpec {
  type: RuntimeEvent["type"];
  fidelity: EventFidelity;
  data: Record<string, unknown>;
}

function log(text: string, stream: "stdout" | "stderr" = "stdout"): EventSpec {
  return { type: "runtime.log", fidelity: "raw_log", data: { stream, text } };
}

function toolCall(
  tool: string,
  args: Record<string, unknown>,
  result: Record<string, unknown>,
): EventSpec {
  return { type: "runtime.tool_call", fidelity: "parsed", data: { tool, args, result } };
}

interface TurnContext {
  run_id: string;
  step_run_id: string;
  agent_session_id: string;
  provider_session_id: string;
}

function providerSessionId(agentSessionId: string): string {
  return `fake-session-${agentSessionId}`;
}

function buildEvent(
  ctx: TurnContext,
  turn: number,
  index: number,
  spec: EventSpec,
  occurredAtMs: number,
  instanceId: string,
): RuntimeEvent {
  return {
    id: `${ctx.agent_session_id}:${instanceId}:${turn}:${index}`,
    run_id: ctx.run_id,
    step_run_id: ctx.step_run_id,
    agent_session_id: ctx.agent_session_id,
    type: spec.type,
    source: "otomat",
    occurred_at: new Date(occurredAtMs).toISOString(),
    payload: {
      fidelity: spec.fidelity,
      adapter: FAKE_ADAPTER_ID,
      test_adapter: true,
      ...spec.data,
    },
    raw_ref: null,
  };
}

function runSpecs(prompt: string, providerSession: string): EventSpec[] {
  return [
    {
      type: "runtime.provider_session",
      fidelity: "native",
      data: {
        provider_session_id: providerSession,
        frame: { kind: "session.created", session: providerSession, model: FAKE_USAGE.model },
      },
    },
    log("[fake] session started"),
    log(`[fake] received prompt: ${prompt}`),
    toolCall("read_file", { path: "README.md" }, { ok: true, bytes: 42 }),
    {
      type: "runtime.permission_request",
      fidelity: "parsed",
      data: { request_id: "perm-1", action: "write_file", path: "src/index.ts" },
    },
    {
      type: "runtime.permission_response",
      fidelity: "parsed",
      data: { request_id: "perm-1", decision: "approved", auto: true },
    },
    log("[fake] applying changes"),
    toolCall("write_file", { path: "src/index.ts" }, { ok: true, bytes: 17 }),
    { type: "runtime.usage", fidelity: "parsed", data: { usage: FAKE_USAGE } },
    log("[fake] done"),
  ];
}

function resumeSpecs(prompt: string, providerSession: string): EventSpec[] {
  return [
    log(`[fake] resumed session ${providerSession}`),
    log(`[fake] follow-up: ${prompt}`),
    toolCall("edit_file", { path: "src/index.ts" }, { ok: true, bytes: 9 }),
    { type: "runtime.usage", fidelity: "parsed", data: { usage: FAKE_USAGE } },
    log("[fake] done"),
  ];
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
  readonly displayName = "Fake Runtime (test adapter)";
  readonly capabilities: RuntimeCapabilities = {
    stream: true,
    send_message: true,
    abort: true,
    resume: true,
    permissions: true,
    diff_hints: false,
  };

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

  async run(
    input: RuntimeRunInput,
    sink: RuntimeSink,
    signal: AbortSignal,
  ): Promise<RuntimeFinalState> {
    writeFakeWork(input.cwd, input.prompt, false);
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
    writeFakeWork(input.cwd, input.prompt, true);
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
      event_count: emitted,
    };
  }
}

function abortSpec(): EventSpec {
  return log("[fake] aborted", "stderr");
}

function canceledState(providerSession: string, emitted: number): RuntimeFinalState {
  return {
    status: "canceled",
    provider_session_id: providerSession,
    usage: null,
    error: null,
    event_count: emitted,
  };
}
