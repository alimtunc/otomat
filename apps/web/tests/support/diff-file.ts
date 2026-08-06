import type { DiffFileContract } from "@otomat/domain";

export function diffFile(
  overrides: Partial<DiffFileContract> & { path: string },
): DiffFileContract {
  return {
    old_path: null,
    status: "modified",
    additions: 1,
    deletions: 0,
    binary: false,
    patch: "",
    sha: `sha-${overrides.path}`,
    ...overrides,
  };
}
