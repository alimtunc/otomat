/**
 * Read-only Linear mirror. The Personal API key lives in `credential.ts` for the
 * lifetime of the process and never reaches SQLite, logs, responses, or a child
 * process environment; `client.ts` is the only Linear caller, and `sync.ts` owns
 * the watermark that keeps re-imports idempotent.
 *
 * @packageDocumentation
 */
export { createLinearApiClient } from "./client.js";
export { createLinearCredentialStore, takeLinearKeyFromEnv } from "./credential.js";
export { LINEAR_ERROR_MESSAGES, LinearError, linearError, safeLinearFailure } from "./errors.js";
export { createLinearService } from "./service.js";
export { SYNC_OVERLAP_MS, SYNC_RESOURCE, SYNC_SOURCE, syncIssueSource } from "./sync.js";
export { createLinearTransport } from "./transport.js";
export type {
  LinearApiClient,
  LinearCredentialStore,
  LinearIssue,
  LinearIssueQuery,
  LinearService,
  LinearServiceConfig,
  LinearTransport,
  LinearTransportRequest,
  LinearTransportResponse,
  LinearViewer,
} from "./types.js";
