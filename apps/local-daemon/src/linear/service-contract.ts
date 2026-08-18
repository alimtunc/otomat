import type { Db } from "@otomat/db";
import type {
  CreateIssueSourceRequest,
  IssueSourceContract,
  IssueSourceSyncResult,
  LinearConnectionContract,
  LinearLifecycleReconcileResult,
  LinearLifecycleSignal,
  LinearSyncStatusContract,
  LinearWorkspaceContract,
  SyncLinearRequest,
  UpdateIssueSourceRequest,
} from "@otomat/domain";

import type { LinearApiClient } from "./client/types.js";
import type { LinearWriteback } from "./writeback/types.js";

export interface LinearServiceConfig {
  db: Db;
  dataDir: string;
  client: LinearApiClient;
  idFactory?: () => string;
  now?: () => Date;
}

export interface LinearService {
  connection(): LinearConnectionContract;
  connect(apiKey: string): Promise<LinearConnectionContract>;
  disconnect(): LinearConnectionContract;
  workspace(): Promise<LinearWorkspaceContract>;
  sources(projectId?: string): IssueSourceContract[];
  createSource(request: CreateIssueSourceRequest): Promise<IssueSourceContract>;
  /** Rewrites one source's lifecycle mapping against its own team's live workflow states. */
  updateSource(sourceId: string, request: UpdateIssueSourceRequest): Promise<IssueSourceContract>;
  deleteSource(sourceId: string): void;
  /** Applies the confirmed mapping to this source's issues that still hold an open workspace. */
  reconcileSource(sourceId: string): Promise<LinearLifecycleReconcileResult>;
  sync(request?: SyncLinearRequest): Promise<IssueSourceSyncResult[]>;
  syncStatus(projectId: string): LinearSyncStatusContract;
  /** Mirrors one canonical run-lifecycle change onto the linked issue; a no-op without write right or mapping. */
  syncIssueLifecycle(signal: LinearLifecycleSignal): Promise<void>;
  writeback: LinearWriteback;
}
