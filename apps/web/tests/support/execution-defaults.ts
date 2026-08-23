import { EMPTY_EXECUTION_DEFAULTS, type ExecutionDefaults } from "@otomat/domain";
import { vi } from "vitest";

export function executionDefaultsQueryResult(
  defaults: ExecutionDefaults = EMPTY_EXECUTION_DEFAULTS,
) {
  return {
    data: defaults,
    isPending: false,
    isError: false,
    isSuccess: true,
    refetch: vi.fn(),
  };
}
