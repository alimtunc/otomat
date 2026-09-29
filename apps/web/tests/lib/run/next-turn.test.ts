import { nextTurnRefusal } from "@web/lib/run/next-turn";
import { expect, it } from "vitest";

const RESUMABLE = "provider-1";

it("refuses a revision until the runtime and the session can take one", () => {
  const supported = { status: "supported" } as const;

  expect(nextTurnRefusal(undefined, true, false, RESUMABLE)).toBe("Checking model support…");
  expect(nextTurnRefusal(undefined, false, true, RESUMABLE)).toContain("Could not read");
  expect(nextTurnRefusal(undefined, false, false, RESUMABLE)).toContain("not registered");
  expect(
    nextTurnRefusal({ status: "unsupported", reason: "No model flag." }, false, false, RESUMABLE),
  ).toBe("No model flag. Add a follow-up step to use another model.");
  expect(nextTurnRefusal(supported, false, false, null)).toContain("no provider session");
  expect(nextTurnRefusal(supported, false, false, RESUMABLE)).toBeNull();
});
