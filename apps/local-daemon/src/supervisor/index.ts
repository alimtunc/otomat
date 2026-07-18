/**
 * Process supervisor: spawns and tracks a child worker process per agent turn, with
 * semaphore-bounded concurrency. `createSupervisor` is the entry point; run its
 * `reconcile()` once on boot — before accepting new work — to settle runs left
 * non-terminal by a crash or kill. Commands carry heavy side effects (spawns/kills
 * processes, writes markers into each run's `events.jsonl`); settle and reconcile are
 * idempotent on an already-terminal run.
 *
 * @packageDocumentation
 */
export * from "./types.js";
export { RunNotResumableError } from "./commands.js";
export { ProjectNotFoundError } from "./prepare.js";
export { buildTerminalMarker } from "./markers.js";
export { createReexecSpawn, isProcessAlive, killProcessGroup } from "./process.js";
export { reconcileRuns } from "./reconcile.js";
export { createSupervisor } from "./supervisor.js";
export { parseJob, runWorkerJob, runWorkerMain, writeTerminalMarker } from "./worker.js";
