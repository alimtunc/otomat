import { getLinearConnection, type Db, type LinearConnectionRow } from "@otomat/db";
import type { LinearConnectionContract } from "@otomat/domain";

import { LinearError, linearError } from "./errors.js";

export function requireConnectionRow(db: Db, connectionId: string): LinearConnectionRow {
  const row = getLinearConnection(db, connectionId);
  if (row === undefined) throw linearError("linear_connection_not_found");
  return row;
}

export interface LinearAuthorization {
  apiKey: string;
  signal: AbortSignal;
  /** Runs one call under this connection's key, retiring it the moment Linear rejects it. */
  run<T>(call: () => Promise<T>): Promise<T>;
}

/** Keys live only in this process's memory — never SQLite, a log or a worktree — under one AbortController per connection. */
export class LinearConnectionRegistry {
  private readonly keys = new Map<string, string>();
  private readonly controllers = new Map<string, AbortController>();
  private readonly failures = new Map<string, LinearError>();

  /** Retires every call made with this connection's previous key and clears its state. */
  begin(id: string): AbortSignal {
    this.keys.delete(id);
    this.failures.delete(id);
    this.controllers.get(id)?.abort();
    const controller = new AbortController();
    this.controllers.set(id, controller);
    return controller.signal;
  }

  hold(id: string, apiKey: string): void {
    this.keys.set(id, apiKey);
  }

  fail(id: string, error: LinearError): void {
    this.failures.set(id, error);
  }

  forget(id: string): void {
    this.begin(id);
    this.controllers.delete(id);
  }

  holdsKey(id: string): boolean {
    return this.keys.has(id);
  }

  isCurrent(id: string, signal: AbortSignal): boolean {
    return this.controllers.get(id)?.signal === signal && !signal.aborted;
  }

  authorize(id: string): LinearAuthorization {
    const apiKey = this.keys.get(id);
    const signal = this.controllers.get(id)?.signal;
    if (apiKey === undefined || signal === undefined) throw linearError("linear_not_connected");
    return {
      apiKey,
      signal,
      run: async <T>(call: () => Promise<T>): Promise<T> => {
        try {
          const response = await call();
          if (!this.isCurrent(id, signal)) throw linearError("linear_request_superseded");
          return response;
        } catch (error) {
          if (!this.isCurrent(id, signal)) throw linearError("linear_request_superseded");
          if (error instanceof LinearError && error.code === "linear_unauthorized") {
            this.begin(id);
            this.fail(id, error);
          }
          throw error;
        }
      },
    };
  }

  contract(row: LinearConnectionRow): LinearConnectionContract {
    const identity = {
      id: row.id,
      label: row.label,
      workspace_id: row.workspace_id,
      workspace_name: row.workspace_name,
      user_name: row.user_name,
    };
    if (this.keys.has(row.id)) {
      return { ...identity, status: "connected", error_code: null, error_message: null };
    }
    const failure = this.failures.get(row.id);
    if (failure === undefined) {
      return { ...identity, status: "disconnected", error_code: null, error_message: null };
    }
    return {
      ...identity,
      status: "failed",
      error_code: failure.code,
      error_message: failure.message,
    };
  }
}
