import { expect, it } from "vitest";

import { DATA_RETENTION_POLICY } from "#main/data-safety/storage-policy";

it("makes retained worktrees and large artifacts an inspect-first manual policy", () => {
  expect(DATA_RETENTION_POLICY).toContain("Archived worktrees");
  expect(DATA_RETENTION_POLICY).toContain("large run artifacts");
  expect(DATA_RETENTION_POLICY).toContain("never deletes");
  expect(DATA_RETENTION_POLICY).toMatch(/inspect/i);
});
