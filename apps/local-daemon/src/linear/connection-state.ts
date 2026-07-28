import type { LinearConnectionContract } from "@otomat/domain";

import type { LinearViewer } from "./client/types.js";
import type { LinearError } from "./errors.js";

export const DISCONNECTED: LinearConnectionContract = {
  status: "disconnected",
  workspace_id: null,
  workspace_name: null,
  user_name: null,
  error_code: null,
  error_message: null,
};

export function connected(viewer: LinearViewer): LinearConnectionContract {
  return {
    status: "connected",
    workspace_id: viewer.workspace_id,
    workspace_name: viewer.workspace_name,
    user_name: viewer.user_name,
    error_code: null,
    error_message: null,
  };
}

export function failed(error: LinearError): LinearConnectionContract {
  return {
    status: "failed",
    workspace_id: null,
    workspace_name: null,
    user_name: null,
    error_code: error.code,
    error_message: error.message,
  };
}
