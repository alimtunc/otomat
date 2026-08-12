import type { ProviderOptionSet } from "@otomat/domain";
import { vi } from "vitest";

import type { MockedQueryResult } from "./query-result.js";

/** The options a runtime and model announce, for surfaces that render an effort or option picker. Announces none by default, so a surface under test invents no level. */
export function providerOptionSet(overrides: Partial<ProviderOptionSet> = {}): ProviderOptionSet {
  return {
    runtime: "claude",
    model: null,
    detection: { status: "unsupported", detail: "This runtime announces no tunable option." },
    options: [],
    ...overrides,
  };
}

/** What `useRuntimeProviderOptions` resolves to in a mocked `@web/api/daemon/queries`; called from inside the hook so the module mock stays hoistable. */
export function providerOptionSetQueryResult(
  set: ProviderOptionSet = providerOptionSet(),
): MockedQueryResult<ProviderOptionSet> {
  return {
    data: set,
    isPending: false,
    isError: false,
    isSuccess: true,
    refetch: vi.fn(),
  };
}
