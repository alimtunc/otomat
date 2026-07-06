import type { RuntimeRunInput, RuntimeSessionRef } from "#runtime/contract";

/** Canonical run-input fabricator for adapter tests; override what the case cares about. */
export function runtimeRunInput(
  overrides: Partial<RuntimeRunInput> & Pick<RuntimeRunInput, "run_dir">,
): RuntimeRunInput {
  return {
    run_id: "run-1",
    step_run_id: "step-1",
    agent_session_id: "sess-1",
    prompt: "create hello.txt",
    ...overrides,
  };
}

/** Canonical session-ref fabricator for resume tests; ids match `runtimeRunInput`. */
export function runtimeSessionRef(provider_session_id: string | null): RuntimeSessionRef {
  return {
    run_id: "run-1",
    step_run_id: "step-1",
    agent_session_id: "sess-1",
    provider_session_id,
  };
}
