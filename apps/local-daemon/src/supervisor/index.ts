/**
 * Process supervisor: spawns and tracks a child worker process per agent turn, with
 * semaphore-bounded concurrency. The bound is this host's own persisted setting,
 * live-resizable through `setCapacity`; a launch answers as soon as its rows are
 * durable and queues for a slot in FIFO order. `createSupervisor` is the entry point;
 * run its `reconcile()` once on boot — before accepting new work — to settle runs left
 * non-terminal by a crash or kill. Commands carry heavy side effects (spawns/kills
 * processes, writes markers into each run's `events.jsonl`); settle and reconcile are
 * idempotent on an already-terminal run.
 *
 * @packageDocumentation
 */
export * from "./types.js";
export { RunNotResumableError } from "./resume.js";
export { issueWorkspace, RunWorkspaceClosedError } from "./workspace.js";
export { RunContributionNotFoundError, RunContributionNotRetriableError } from "./contributions.js";
export { LaunchRefusedError } from "./launch-target.js";
export { closeMergedRun, type MergeClosureConfig } from "./merge-closure.js";
export { buildTerminalMarker } from "./markers.js";
export { createReexecSpawn, isProcessAlive, killProcessGroup } from "./process.js";
export { WORKER_START_TOKEN_ENV } from "./start-gate.js";
export { reconcileRuns } from "./reconcile.js";
export { createSupervisor } from "./supervisor.js";
export { parseJob, runWorkerJob, runWorkerMain, writeTerminalMarker } from "./worker.js";
