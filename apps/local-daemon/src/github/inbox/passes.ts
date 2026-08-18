import { failureMessage } from "../errors.js";

export interface PullRequestSyncOutcome {
  error: { message: string } | null;
}

const NO_OUTCOME: PullRequestSyncOutcome = { error: null };

export class PullRequestSyncPasses {
  private readonly passes = new Map<string, Promise<PullRequestSyncOutcome>>();
  private readonly outcomes = new Map<string, PullRequestSyncOutcome>();

  /** Never rejects: a failed pass must still answer the rows it had. */
  pass(projectId: string, run: () => Promise<void>): Promise<PullRequestSyncOutcome> {
    const current = this.passes.get(projectId);
    if (current !== undefined) return current;
    const done = run().then(
      () => this.settle(projectId, null),
      (cause: unknown) => this.settle(projectId, { message: failureMessage(cause) }),
    );
    this.passes.set(projectId, done);
    void done.then(() => {
      if (this.passes.get(projectId) === done) this.passes.delete(projectId);
    });
    return done;
  }

  running(projectId: string): boolean {
    return this.passes.has(projectId);
  }

  outcome(projectId: string): PullRequestSyncOutcome {
    return this.outcomes.get(projectId) ?? NO_OUTCOME;
  }

  private settle(
    projectId: string,
    error: PullRequestSyncOutcome["error"],
  ): PullRequestSyncOutcome {
    const outcome = { error };
    this.outcomes.set(projectId, outcome);
    return outcome;
  }
}
