import type { LinearConnectionContract } from "@otomat/domain";

import type { LinearApiClient, LinearService } from "#linear";

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

export function stubLinearService(overrides: Partial<LinearService> = {}): LinearService {
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
    ...overrides,
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
    ...overrides,
  };
}
