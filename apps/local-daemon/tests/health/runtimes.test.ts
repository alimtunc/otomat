import { writeExecutionDefaults } from "@otomat/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runtimesCheck } from "#health/checks/runtimes";
import { setupTestDb, type TestDb } from "#test-support/db";

/** An empty PATH is how a host with no provider CLI installed reads to the registry. */
const NO_BINARIES: NodeJS.ProcessEnv = { PATH: "" };

describe("runtimesCheck", () => {
  let t: TestDb;

  beforeEach(() => {
    t = setupTestDb("otomat-health-runtimes-");
  });

  afterEach(() => t.cleanup());

  it("errors when no agent CLI is detected on the host", () => {
    expect(runtimesCheck(t.db, NO_BINARIES)).toMatchObject({
      status: "error",
      message: expect.stringContaining("No agent CLI was detected"),
    });
  });

  it("errors when the host default runtime is not usable here", () => {
    writeExecutionDefaults(t.db, { runtime: "claude", model: null, options: {} });

    expect(runtimesCheck(t.db, { PATH: "", OTOMAT_ENABLE_FAKE_RUNTIME: "1" })).toMatchObject({
      status: "error",
      message: expect.stringContaining('"claude" is not usable here'),
    });
  });

  it("is ready once a runtime is detected, naming the ones that are not", () => {
    const check = runtimesCheck(t.db, { PATH: "", OTOMAT_ENABLE_FAKE_RUNTIME: "1" });

    expect(check.status).toBe("ready");
    expect(check.message).toContain("Not detected:");
    expect(check.remediation).toBeNull();
  });
});
