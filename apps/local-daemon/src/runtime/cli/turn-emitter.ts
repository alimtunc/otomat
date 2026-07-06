import type { RuntimeSessionRef } from "#runtime/contract";
import { buildRuntimeEvent, type EventFidelity, type RuntimeEvent } from "#runtime/events";
import type { RuntimeSink } from "#runtime/sinks";

export type TurnRef = Pick<RuntimeSessionRef, "run_id" | "step_run_id" | "agent_session_id">;

/** Per-turn emit surface for CLI adapters: stamps envelope identity/provenance and counts emissions for the final state. */
export class TurnEmitter {
  private count = 0;

  constructor(
    private readonly sink: RuntimeSink,
    private readonly adapter: string,
    private readonly source: RuntimeEvent["source"],
    private readonly ref: TurnRef,
  ) {}

  emit(
    type: RuntimeEvent["type"],
    fidelity: EventFidelity,
    payload: Record<string, unknown>,
  ): void {
    this.push(type, fidelity, payload, this.source);
  }

  log(stream: "stdout" | "stderr", text: string): void {
    this.emit("runtime.log", "raw_log", { stream, text });
  }

  /** Daemon-fabricated diagnostics carry source `otomat` and an `[otomat]` text prefix so nothing daemon-made reads as provider output. */
  daemonLog(text: string): void {
    this.push("runtime.log", "raw_log", { stream: "stderr", text: `[otomat] ${text}` }, "otomat");
  }

  private push(
    type: RuntimeEvent["type"],
    fidelity: EventFidelity,
    payload: Record<string, unknown>,
    source: RuntimeEvent["source"],
  ): void {
    this.sink.emit(
      buildRuntimeEvent({
        runId: this.ref.run_id,
        kind: type,
        type,
        source,
        adapter: this.adapter,
        fidelity,
        occurredAt: new Date().toISOString(),
        stepRunId: this.ref.step_run_id,
        agentSessionId: this.ref.agent_session_id,
        payload,
      }),
    );
    this.count += 1;
  }

  get emitted(): number {
    return this.count;
  }
}
