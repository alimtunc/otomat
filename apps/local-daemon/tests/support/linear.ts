import type { LinearConnectionContract } from "@otomat/domain";

import type { LinearApiClient, LinearService, LinearWriteback } from "#linear";

type ConnectedLinear = Extract<LinearConnectionContract, { status: "connected" }>;

const DISCONNECTED_LINEAR: Extract<LinearConnectionContract, { status: "disconnected" }> = {
  status: "disconnected",
  workspace_id: null,
  workspace_name: null,
  user_name: null,
  error_code: null,
  error_message: null,
};

export function connectedLinear(): ConnectedLinear {
  return {
    status: "connected",
    workspace_id: "workspace-1",
    workspace_name: "Otomat",
    user_name: "Alim",
    error_code: null,
    error_message: null,
  };
}

export function stubLinearWriteback(overrides: Partial<LinearWriteback> = {}): LinearWriteback {
  return {
    writebackState: () => ({ draft: null, writes: [] }),
    editorState: async () => {
      throw new Error("editorState stub not configured");
    },
    comments: async () => {
      throw new Error("comments stub not configured");
    },
    saveDraft: () => {
      throw new Error("saveDraft stub not configured");
    },
    discardDraft: () => {},
    publishFields: async () => {
      throw new Error("publishFields stub not configured");
    },
    publishStatus: async () => {
      throw new Error("publishStatus stub not configured");
    },
    publishComment: async () => {
      throw new Error("publishComment stub not configured");
    },
    publishPrLink: async () => {
      throw new Error("publishPrLink stub not configured");
    },
    retryWrite: async () => {
      throw new Error("retryWrite stub not configured");
    },
    ...overrides,
  };
}

export function stubLinearService(
  overrides: Partial<Omit<LinearService, "writeback">> & {
    writeback?: Partial<LinearWriteback>;
  } = {},
): LinearService {
  const { writeback, ...service } = overrides;
  return {
    connection: () => DISCONNECTED_LINEAR,
    connect: async () => {
      throw new Error("connect stub not configured");
    },
    disconnect: () => DISCONNECTED_LINEAR,
    workspace: async () => {
      throw new Error("workspace stub not configured");
    },
    sources: () => [],
    createSource: async () => {
      throw new Error("createSource stub not configured");
    },
    sync: async () => {
      throw new Error("sync stub not configured");
    },
    writeback: stubLinearWriteback(writeback),
    ...service,
  };
}

export function stubLinearApiClient(overrides: Partial<LinearApiClient> = {}): LinearApiClient {
  return {
    viewer: async () => {
      throw new Error("viewer stub not configured");
    },
    workspace: async () => {
      throw new Error("workspace stub not configured");
    },
    issues: async () => {
      throw new Error("issues stub not configured");
    },
    issueEditor: async () => {
      throw new Error("issueEditor stub not configured");
    },
    issueSnapshot: async () => {
      throw new Error("issueSnapshot stub not configured");
    },
    updateIssue: async () => {
      throw new Error("updateIssue stub not configured");
    },
    listComments: async () => {
      throw new Error("listComments stub not configured");
    },
    createComment: async () => {
      throw new Error("createComment stub not configured");
    },
    linkAttachment: async () => {
      throw new Error("linkAttachment stub not configured");
    },
    ...overrides,
  };
}
