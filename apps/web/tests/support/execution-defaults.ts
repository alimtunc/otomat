import { EMPTY_EXECUTION_DEFAULTS, type ExecutionDefaults } from "@otomat/domain";
import { vi } from "vitest";

/** What `useExecutionDefaults` resolves to in a mocked `@web/api/daemon/queries`; nothing is selected by default, so a surface under test invents no fallback. */
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
