import type { LinearConnectionContract } from "@otomat/domain";

import type { LinearApiClient, LinearService } from "#linear";

export const DISCONNECTED_LINEAR: LinearConnectionContract = {
  status: "disconnected",
  workspace_name: null,
  workspace_url_key: null,
  user_name: null,
  error_code: null,
  error_message: null,
};

export function connectedLinear(
  overrides: Partial<LinearConnectionContract> = {},
): LinearConnectionContract {
  return {
    status: "connected",
    workspace_name: "Otomat",
    workspace_url_key: "otomat",
    user_name: "Alim",
    error_code: null,
    error_message: null,
    ...overrides,
  };
}

/** Un-overridden members throw so a missing stub fails loudly instead of fake-succeeding. */
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
    createSource: () => {
      throw new Error("createSource stub not configured");
    },
    sync: async () => {
      throw new Error("sync stub not configured");
    },
    ...overrides,
  };
}

/** Queued fake transport-level client: each call shifts the next scripted result. */
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
