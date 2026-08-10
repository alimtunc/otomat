import type { IssueSourceRow } from "@otomat/db";
import type { IssueSourceSyncResult, LinearErrorCode, SyncLinearRequest } from "@otomat/domain";

import { LinearError } from "./errors.js";

interface Pass {
  full: boolean;
  done: Promise<IssueSourceSyncResult>;
}

export interface LinearSyncOutcome {
  result: { imported: number; updated: number } | null;
  error: { code: LinearErrorCode | null; message: string } | null;
}

const NO_OUTCOME: LinearSyncOutcome = { result: null, error: null };

/** Buckets one sync request's results by the project each source feeds, empty buckets included. */
export function syncScope(
  request: SyncLinearRequest,
  sources: IssueSourceRow[],
  results: IssueSourceSyncResult[],
): Map<string, IssueSourceSyncResult[]> {
  const scope = new Map<string, IssueSourceSyncResult[]>();
  if (request.project_id !== undefined) scope.set(request.project_id, []);
  sources.forEach((source, index) => {
    const bucket = scope.get(source.project_id) ?? [];
    const result = results[index];
    if (result !== undefined) bucket.push(result);
    scope.set(source.project_id, bucket);
  });
  return scope;
}

/**
 * What this daemon knows about its own Linear passes: which sources are mid-flight,
 * and how the last pass for each project ended. Persisted freshness lives in
 * `sync_state`; only what dies with the process is held here.
 */
export class LinearSyncRuns {
  private readonly passes = new Map<string, Pass>();
  private readonly outcomes = new Map<string, LinearSyncOutcome>();

  /**
   * Joins an identical in-flight pass rather than issuing a second Linear read. A
   * full reconciliation instead queues behind the incremental pass it exists to
   * repair; that pass's failure is delivered to its own caller, so it must not
   * cancel this one.
   */
  pass(
    sourceId: string,
    full: boolean,
    run: () => Promise<IssueSourceSyncResult>,
  ): Promise<IssueSourceSyncResult> {
    const current = this.passes.get(sourceId);
    if (current !== undefined && current.full === full) return current.done;
    const done = current === undefined ? run() : current.done.then(run, run);
    const pass: Pass = { full, done };
    this.passes.set(sourceId, pass);
    const release = (): void => {
      if (this.passes.get(sourceId) === pass) this.passes.delete(sourceId);
    };
    void done.then(release, release);
    return done;
  }

  running(sourceIds: string[]): boolean {
    return sourceIds.some((sourceId) => this.passes.has(sourceId));
  }

  outcome(projectId: string): LinearSyncOutcome {
    return this.outcomes.get(projectId) ?? NO_OUTCOME;
  }

  succeeded(scope: Map<string, IssueSourceSyncResult[]>): void {
    for (const [projectId, results] of scope) {
      this.outcomes.set(projectId, {
        result: {
          imported: results.reduce((total, result) => total + result.imported, 0),
          updated: results.reduce((total, result) => total + result.updated, 0),
        },
        error: null,
      });
    }
  }

  failed(scope: Map<string, IssueSourceSyncResult[]>, cause: unknown): void {
    if (cause instanceof LinearError && cause.code === "linear_request_superseded") return;
    const error = {
      code: cause instanceof LinearError ? cause.code : null,
      message:
        cause instanceof Error && cause.message !== "" ? cause.message : "The Linear sync failed.",
    };
    for (const projectId of scope.keys()) {
      this.outcomes.set(projectId, { result: this.outcome(projectId).result, error });
    }
  }
}
