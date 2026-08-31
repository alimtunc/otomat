import type { LinearConnectionContract } from "@otomat/domain";

export function linearConnection(
  overrides: Partial<LinearConnectionContract> = {},
): LinearConnectionContract {
  return {
    id: "c-otomat",
    label: "Otomat",
    workspace_id: "workspace-1",
    workspace_name: "Otomat",
    user_name: "Alim",
    status: "connected",
    error_code: null,
    error_message: null,
    ...overrides,
  };
}
