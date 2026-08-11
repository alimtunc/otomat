import { expect, it } from "vitest";

import { createRuntimeAdapter } from "#runtime";

const REAL_PROVIDERS = ["claude", "codex"] as const;

it.each(REAL_PROVIDERS)("%s steers at a turn boundary and can resume its session", (id) => {
  const { capabilities } = createRuntimeAdapter(id);

  expect(capabilities.steering).toBe("turn_boundary");
  expect(capabilities.resume).toBe(true);
});
