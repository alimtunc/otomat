import type { ProviderOptionSet } from "@otomat/domain";
import { vi } from "vitest";

export function providerOptionSet(overrides: Partial<ProviderOptionSet> = {}): ProviderOptionSet {
  return {
    runtime: "claude",
    model: null,
    detection: { status: "unsupported", detail: "This runtime announces no tunable option." },
    options: [],
    ...overrides,
  };
}

export function providerOptionSetQueryResult(set: ProviderOptionSet = providerOptionSet()) {
  return {
    data: set,
    isPending: false,
    isError: false,
    isSuccess: true,
    refetch: vi.fn(),
  };
}
