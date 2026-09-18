export { createLinearApiClient } from "./client/index.js";
export { takeLinearKeyFromEnv } from "./credential.js";
export { LinearError, LinearWriteConflictError, linearError } from "./errors.js";
export { createLinearService } from "./service.js";
export type { LinearService, LinearServiceConfig } from "./service-contract.js";
export {
  issueStateFromLinear,
  SYNC_OVERLAP_MS,
  SYNC_RESOURCE,
  SYNC_SOURCE,
  syncIssueSource,
} from "./sync.js";
export { createLinearTransport, LINEAR_REQUEST_TIMEOUT_MS } from "./transport.js";
export type {
  LinearTransport,
  LinearTransportRequest,
  LinearTransportResponse,
} from "./transport.js";
export { LINEAR_FILE_MAX_BYTES } from "./client/files.js";
export type {
  LinearApiClient,
  LinearAttachment,
  LinearAttachmentInput,
  LinearCommentInput,
  LinearFile,
  LinearIssue,
  LinearIssueDetail,
  LinearIssueEditor,
  LinearIssueQuery,
  LinearIssueUpdate,
  LinearLabelRef,
  LinearStateRef,
  LinearUserRef,
} from "./client/types.js";
export type { LinearWriteback } from "./writeback/types.js";
