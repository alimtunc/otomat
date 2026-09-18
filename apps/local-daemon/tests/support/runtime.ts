import { mkdirSync, writeFileSync } from "node:fs";
import { delimiter, join } from "node:path";

import type { RuntimeRunInput, RuntimeSessionRef } from "#runtime/contract";

/** Canonical run-input fabricator for adapter tests; override what the case cares about. */
export function runtimeRunInput(
  overrides: Partial<RuntimeRunInput> & Pick<RuntimeRunInput, "run_dir" | "cwd">,
): RuntimeRunInput {
  return {
    run_id: "run-1",
    step_run_id: "step-1",
    agent_session_id: "sess-1",
    prompt: "create hello.txt",
    images: [],
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

/** Puts a runtime shim on PATH so agent resolution stops gating what a suite is really asserting; answers the restore. */
export function stubRuntimeOnPath(
  dataDir: string,
  runtime: string,
  helpFixture?: string,
): () => void {
  const binDir = join(dataDir, "runtime-bin");
  mkdirSync(binDir, { recursive: true });
  const script = helpFixture === undefined ? "exit 0" : `cat ${JSON.stringify(helpFixture)}`;
  writeFileSync(join(binDir, runtime), `#!/bin/sh\n${script}\n`, { mode: 0o755 });
  const restore = process.env.PATH;
  process.env.PATH = `${binDir}${delimiter}${restore ?? ""}`;
  return () => {
    process.env.PATH = restore;
  };
}
