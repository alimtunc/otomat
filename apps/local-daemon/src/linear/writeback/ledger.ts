import {
  getLinearWrite,
  getLinearWriteByIdentity,
  insertLinearWrite,
  type LinearWriteRow,
  updateLinearWrite,
} from "@otomat/db";
import { linearWriteMachine, type LinearWriteKind, type LinearWriteState } from "@otomat/domain";

import { emitLedgerEvent } from "#events";

import { LinearError } from "../errors.js";
import { buildLinearWriteEvent, linearWriteEventType } from "../events.js";
import type { LinearWritebackConfig, PendingSpec, WriteOutcome } from "./types.js";

function safeLinearFailure(error: unknown): { code: string; message: string } {
  if (error instanceof LinearError) return { code: error.code, message: error.message };
  return { code: "linear_request_failed", message: "Linear returned an unexpected response." };
}

export class LinearWriteLedger {
  private readonly active = new Set<string>();

  constructor(private readonly config: LinearWritebackConfig) {}

  find(id: string): LinearWriteRow | undefined {
    return getLinearWrite(this.config.db, id);
  }

  findByIdentity(issueId: string, kind: LinearWriteKind, key: string): LinearWriteRow | undefined {
    return getLinearWriteByIdentity(this.config.db, issueId, kind, key);
  }

  isActive(row: LinearWriteRow): boolean {
    return this.active.has(row.id);
  }

  ensurePending(existing: LinearWriteRow | undefined, spec: PendingSpec): LinearWriteRow {
    if (existing) {
      updateLinearWrite(this.config.db, existing.id, {
        run_id: spec.runId,
        payload_json: spec.payload,
        detail: spec.detail,
        error_code: null,
        error_message: null,
      });
      return this.reload(existing.id);
    }
    const id = this.config.idFactory();
    insertLinearWrite(this.config.db, {
      id,
      issue_id: spec.issueId,
      run_id: spec.runId,
      kind: spec.kind,
      idempotency_key: spec.key,
      payload_json: spec.payload,
      detail: spec.detail,
    });
    return this.reload(id);
  }

  async run(
    write: LinearWriteRow,
    operation: (apiKey: string, signal: AbortSignal) => Promise<WriteOutcome>,
  ): Promise<void> {
    this.active.add(write.id);
    try {
      const { apiKey, signal } = this.config.authorize();
      const sending = this.transition(write, "sending");
      const outcome = await this.config.guard(signal, () => operation(apiKey, signal));
      const sent = this.transition(sending, "sent", {
        remote_id: outcome.remote_id,
        detail: outcome.detail,
        error_code: null,
        error_message: null,
      });
      this.emitEvent(sent);
    } catch (error) {
      this.fail(this.reload(write.id), error);
      throw error;
    } finally {
      this.active.delete(write.id);
    }
  }

  recover(row: LinearWriteRow): LinearWriteRow {
    if ((row.status !== "pending" && row.status !== "sending") || this.active.has(row.id)) {
      return row;
    }
    return this.transition(row, "failed", {
      error_code: "linear_write_interrupted",
      error_message: "The write was interrupted before Linear confirmed it. Retry to reconcile it.",
    });
  }

  private transition(
    row: LinearWriteRow,
    status: LinearWriteState,
    patch: Parameters<typeof updateLinearWrite>[2] = {},
  ): LinearWriteRow {
    if (row.status !== status) linearWriteMachine.transition(row.status, status);
    updateLinearWrite(this.config.db, row.id, { ...patch, status });
    return this.reload(row.id);
  }

  private fail(row: LinearWriteRow, error: unknown): LinearWriteRow {
    if (row.status === "sent") return row;
    const failure = safeLinearFailure(error);
    return this.transition(row, "failed", {
      error_code: failure.code,
      error_message: failure.message,
    });
  }

  private emitEvent(row: LinearWriteRow): void {
    if (row.run_id === null) return;
    const type = linearWriteEventType(row.kind);
    if (type === null) return;
    emitLedgerEvent(
      this.config.db,
      this.config.dataDir,
      row.run_id,
      buildLinearWriteEvent(row.run_id, type, row, this.config.now().toISOString()),
    );
  }

  private reload(id: string): LinearWriteRow {
    const row = getLinearWrite(this.config.db, id);
    if (!row) throw new Error(`linear write ${id} vanished`);
    return row;
  }
}
